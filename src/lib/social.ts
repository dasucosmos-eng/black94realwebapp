import {
  db,
} from './firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit as firestoreLimit,
  getDocs,
  serverTimestamp,
  increment,
  addDoc,
} from 'firebase/firestore';
import { createNotification } from './db';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface CommentData {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorProfileImage: string;
  authorIsVerified: boolean;
  authorBadge: string;
  content: string;
  createdAt: string;
}

export interface PostInteractionStatus {
  isLiked: boolean;
  isReposted: boolean;
  isBookmarked: boolean;
}

/* ── Helper: Firestore Timestamp → ISO string ──────────────────────────────── */

function tsToISO(value: unknown): string {
  if (value && typeof value === 'object' && 'seconds' in value) {
    const ts = value as { seconds: number; nanoseconds: number };
    return new Date(ts.seconds * 1000 + ts.nanoseconds / 1_000_000).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function docToPost(docSnap: { id: string; data: () => Record<string, unknown> }) {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    authorId: d.authorId ?? '',
    authorUsername: d.authorUsername ?? '',
    authorDisplayName: d.authorDisplayName ?? '',
    authorProfileImage: d.authorProfileImage ?? '',
    authorBadge: d.authorBadge ?? '',
    authorIsVerified: d.authorIsVerified ?? false,
    caption: d.caption ?? '',
    mediaUrls: d.mediaUrls ?? '',
    factCheck: d.factCheck ?? '',
    likeCount: d.likeCount ?? 0,
    commentCount: d.commentCount ?? 0,
    repostCount: d.repostCount ?? 0,
    isLiked: d.isLiked ?? false,
    createdAt: tsToISO(d.createdAt),
    updatedAt: tsToISO(d.updatedAt),
  };
}

/* ── Helper: extract Firebase error info ───────────────────────────────────── */

function getErrorInfo(err: unknown): { code: string; message: string } {
  const e = err as { code?: string; message?: string };
  return {
    code: e.code || 'unknown',
    message: e.message || String(err),
  };
}

/* ── Collection names (top-level, NOT subcollections) ──────────────────────── */

const LIKES_COL = 'post_likes';
const COMMENTS_COL = 'post_comments';
const REPOSTS_COL = 'post_reposts';
const BOOKMARKS_COL = 'post_bookmarks';

/* ═══════════════════════════════════════════════════════════════════════════
   LIKES — stored in top-level "post_likes" collection
   ═══════════════════════════════════════════════════════════════════════════ */

export async function togglePostLike(postId: string, userId: string): Promise<boolean> {
  const docId = `${postId}_${userId}`;
  const likeRef = doc(db, LIKES_COL, docId);
  const postRef = doc(db, 'posts', postId);

  try {
    const likeSnap = await getDoc(likeRef);
    console.log(`[social] togglePostLike: doc ${docId} exists=${likeSnap.exists()}`);

    if (likeSnap.exists()) {
      // Unlike
      await deleteDoc(likeRef);
      console.log(`[social] togglePostLike: deleted like doc`);
      try {
        await updateDoc(postRef, { likeCount: increment(-1) });
      } catch (countErr) {
        console.warn('[social] togglePostLike: count update failed (non-critical):', getErrorInfo(countErr));
      }
      return false;
    } else {
      // Like
      await setDoc(likeRef, { postId, userId, createdAt: serverTimestamp() });
      console.log(`[social] togglePostLike: created like doc`);
      try {
        await updateDoc(postRef, { likeCount: increment(1) });
      } catch (countErr) {
        console.warn('[social] togglePostLike: count update failed (non-critical):', getErrorInfo(countErr));
      }
      // Notify post author (fire-and-forget)
      try {
        const postSnap = await getDoc(postRef);
        const post = postSnap.data();
        if (post && post.authorId && post.authorId !== userId) {
          const actorSnap = await getDoc(doc(db, 'users', userId));
          const actor = actorSnap.exists() ? actorSnap.data() : null;
          createNotification({
            userId: post.authorId,
            type: 'like',
            actorId: userId,
            actorName: actor?.displayName || '',
            actorUsername: actor?.username || '',
            actorProfileImage: actor?.profileImage || '',
            postId,
            message: 'liked your post',
          });
        }
      } catch (e) {
        console.warn('[social] togglePostLike: notification failed (non-critical):', e);
      }
      return true;
    }
  } catch (err) {
    const info = getErrorInfo(err);
    console.error(`[social] togglePostLike FAILED: code=${info.code}, msg=${info.message}`);
    throw new Error(`Like failed: ${info.code} — ${info.message}`);
  }
}

export async function checkUserLikedPost(postId: string, userId: string): Promise<boolean> {
  const docId = `${postId}_${userId}`;
  const snap = await getDoc(doc(db, LIKES_COL, docId));
  return snap.exists();
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMMENTS — stored in top-level "post_comments" collection
   ═══════════════════════════════════════════════════════════════════════════ */

export async function addPostComment(
  postId: string,
  userId: string,
  content: string,
  authorData: { username: string; displayName: string; profileImage: string; isVerified?: boolean; badge?: string },
): Promise<CommentData> {
  try {
    console.log(`[social] addPostComment: postId=${postId}, userId=${userId}`);
    const commentRef = await addDoc(collection(db, COMMENTS_COL), {
      postId,
      authorId: userId,
      authorUsername: authorData.username,
      authorDisplayName: authorData.displayName,
      authorProfileImage: authorData.profileImage,
      authorIsVerified: authorData.isVerified ?? false,
      authorBadge: authorData.badge ?? '',
      content,
      createdAt: serverTimestamp(),
    });
    console.log(`[social] addPostComment: created comment ${commentRef.id}`);

    // Try to update comment count on parent post (non-critical)
    try {
      await updateDoc(doc(db, 'posts', postId), {
        commentCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (countErr) {
      console.warn('[social] addPostComment: count update failed (non-critical):', getErrorInfo(countErr));
    }

    // Notify post author (fire-and-forget)
    try {
      const postSnap = await getDoc(doc(db, 'posts', postId));
      const post = postSnap.data();
      if (post && post.authorId && post.authorId !== userId) {
        createNotification({
          userId: post.authorId,
          type: 'comment',
          actorId: userId,
          actorName: authorData.displayName,
          actorUsername: authorData.username,
          actorProfileImage: authorData.profileImage,
          postId,
          message: `commented: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`,
        });
      }
    } catch (e) {
      console.warn('[social] addPostComment: notification failed (non-critical):', e);
    }

    const snap = await getDoc(commentRef);
    const d = snap.data()!;
    return {
      id: snap.id,
      postId,
      authorId: userId,
      authorUsername: authorData.username,
      authorDisplayName: authorData.displayName,
      authorProfileImage: authorData.profileImage,
      authorIsVerified: authorData.isVerified ?? false,
      authorBadge: authorData.badge ?? '',
      content,
      createdAt: tsToISO(d.createdAt),
    };
  } catch (err) {
    const info = getErrorInfo(err);
    console.error(`[social] addPostComment FAILED: code=${info.code}, msg=${info.message}`);
    throw new Error(`Comment failed: ${info.code} — ${info.message}`);
  }
}

export async function fetchPostComments(postId: string): Promise<CommentData[]> {
  console.log(`[social] fetchPostComments: postId=${postId}`);
  try {
    const q = query(
      collection(db, COMMENTS_COL),
      where('postId', '==', postId),
      firestoreLimit(50),
    );
    const snap = await getDocs(q);
    console.log(`[social] fetchPostComments: found ${snap.size} comments`);

    return snap.docs
      .map((docSnap) => {
        const d = docSnap.data()!;
        return {
          id: docSnap.id,
          postId: d.postId ?? postId,
          authorId: d.authorId ?? '',
          authorUsername: d.authorUsername ?? '',
          authorDisplayName: d.authorDisplayName ?? '',
          authorProfileImage: d.authorProfileImage ?? '',
          authorIsVerified: d.authorIsVerified ?? false,
          authorBadge: d.authorBadge ?? '',
          content: d.content ?? '',
          createdAt: tsToISO(d.createdAt),
        };
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (err) {
    const info = getErrorInfo(err);
    console.error(`[social] fetchPostComments FAILED: code=${info.code}, msg=${info.message}`);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   REPOSTS — stored in top-level "post_reposts" collection
   ═══════════════════════════════════════════════════════════════════════════ */

export async function togglePostRepost(postId: string, userId: string): Promise<boolean> {
  const docId = `${postId}_${userId}`;
  const repostRef = doc(db, REPOSTS_COL, docId);
  const postRef = doc(db, 'posts', postId);

  try {
    const repostSnap = await getDoc(repostRef);
    console.log(`[social] togglePostRepost: doc ${docId} exists=${repostSnap.exists()}`);

    if (repostSnap.exists()) {
      await deleteDoc(repostRef);
      console.log(`[social] togglePostRepost: deleted repost doc`);
      try {
        await updateDoc(postRef, { repostCount: increment(-1) });
      } catch (countErr) {
        console.warn('[social] togglePostRepost: count update failed (non-critical):', getErrorInfo(countErr));
      }
      return false;
    } else {
      await setDoc(repostRef, { postId, userId, createdAt: serverTimestamp() });
      console.log(`[social] togglePostRepost: created repost doc`);
      try {
        await updateDoc(postRef, { repostCount: increment(1) });
      } catch (countErr) {
        console.warn('[social] togglePostRepost: count update failed (non-critical):', getErrorInfo(countErr));
      }
      // Notify post author (fire-and-forget)
      try {
        const postSnap = await getDoc(postRef);
        const post = postSnap.data();
        if (post && post.authorId && post.authorId !== userId) {
          const actorSnap = await getDoc(doc(db, 'users', userId));
          const actor = actorSnap.exists() ? actorSnap.data() : null;
          createNotification({
            userId: post.authorId,
            type: 'repost',
            actorId: userId,
            actorName: actor?.displayName || '',
            actorUsername: actor?.username || '',
            actorProfileImage: actor?.profileImage || '',
            postId,
            message: 'shared your post',
          });
        }
      } catch (e) {
        console.warn('[social] togglePostRepost: notification failed (non-critical):', e);
      }
      return true;
    }
  } catch (err) {
    const info = getErrorInfo(err);
    console.error(`[social] togglePostRepost FAILED: code=${info.code}, msg=${info.message}`);
    throw new Error(`Repost failed: ${info.code} — ${info.message}`);
  }
}

export async function checkUserRepostedPost(postId: string, userId: string): Promise<boolean> {
  const docId = `${postId}_${userId}`;
  const snap = await getDoc(doc(db, REPOSTS_COL, docId));
  return snap.exists();
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOOKMARKS — stored in top-level "post_bookmarks" collection
   ═══════════════════════════════════════════════════════════════════════════ */

export async function togglePostBookmark(postId: string, userId: string): Promise<boolean> {
  const docId = `${postId}_${userId}`;
  const bookmarkRef = doc(db, BOOKMARKS_COL, docId);

  try {
    const bookmarkSnap = await getDoc(bookmarkRef);
    console.log(`[social] togglePostBookmark: doc ${docId} exists=${bookmarkSnap.exists()}`);

    if (bookmarkSnap.exists()) {
      await deleteDoc(bookmarkRef);
      return false;
    } else {
      await setDoc(bookmarkRef, {
        postId,
        userId,
        createdAt: serverTimestamp(),
      });
      return true;
    }
  } catch (err) {
    const info = getErrorInfo(err);
    console.error(`[social] togglePostBookmark FAILED: code=${info.code}, msg=${info.message}`);
    throw new Error(`Bookmark failed: ${info.code} — ${info.message}`);
  }
}

export async function checkUserBookmarkedPost(postId: string, userId: string): Promise<boolean> {
  const docId = `${postId}_${userId}`;
  const snap = await getDoc(doc(db, BOOKMARKS_COL, docId));
  return snap.exists();
}

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH CHECK — check all interaction statuses for a set of posts
   ═══════════════════════════════════════════════════════════════════════════ */

export async function checkPostInteractions(
  postIds: string[],
  userId: string,
): Promise<Record<string, PostInteractionStatus>> {
  if (!userId || postIds.length === 0) {
    return {};
  }

  const result: Record<string, PostInteractionStatus> = {};

  // Initialize all as false
  for (const postId of postIds) {
    result[postId] = { isLiked: false, isReposted: false, isBookmarked: false };
  }

  // Build batch query for each interaction type — runs in parallel
  // Uses `where('userId', '==', userId)` + `where('postId', 'in', postIds)` 
  // to replace N individual getDoc calls with 1 query per category.
  // Firestore 'in' operator supports max 30 items per query, so chunk if needed.
  const CHUNK_SIZE = 30;

  const checkBatch = async (
    collectionName: string,
    field: keyof PostInteractionStatus,
  ) => {
    for (let i = 0; i < postIds.length; i += CHUNK_SIZE) {
      const chunk = postIds.slice(i, i + CHUNK_SIZE);
      try {
        const q = query(
          collection(db, collectionName),
          where('userId', '==', userId),
          where('postId', 'in', chunk),
        );
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          const postId = docSnap.data().postId;
          if (postId && result[postId]) {
            (result[postId] as any)[field] = true;
          }
        }
      } catch (err) {
        // Fallback: if the composite index doesn't exist yet, use individual reads
        console.warn(`[social] Batch query failed for ${collectionName}, falling back to individual reads:`, err);
        await Promise.all(chunk.map(async (postId) => {
          const docId = `${postId}_${userId}`;
          const ref = doc(db, collectionName, docId);
          const snap = await getDoc(ref);
          if (snap.exists() && result[postId]) {
            (result[postId] as any)[field] = true;
          }
        }));
      }
    }
  };

  // Run all 3 categories in parallel — saves 2 round-trips of latency
  await Promise.all([
    checkBatch(LIKES_COL, 'isLiked'),
    checkBatch(REPOSTS_COL, 'isReposted'),
    checkBatch(BOOKMARKS_COL, 'isBookmarked'),
  ]);

  return result;
}

/* ═══════════════════════════════════════════════════════════════════════════
   USER POSTS — no composite index required (sort client-side)
   ═══════════════════════════════════════════════════════════════════════════ */

export async function fetchUserPostsNoIndex(uid: string, limitCount: number) {
  const postsRef = collection(db, 'posts');
  const q = query(postsRef, where('authorId', '==', uid), firestoreLimit(limitCount));
  const snap = await getDocs(q);
  // Sort client-side by createdAt descending
  return snap.docs.map(docToPost).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
