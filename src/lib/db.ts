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
  addDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getDocs,
  writeBatch,
  runTransaction,
  serverTimestamp,
  increment,
  getCountFromServer,
  DocumentSnapshot,
  DocumentData,
  type User as FirebaseUser,
} from 'firebase/firestore';
import { getOrCreateKeyPair } from './crypto';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Black94User {
  uid: string;
  email: string;
  username: string;
  usernameLower: string;
  displayName: string;
  bio: string;
  profileImage: string;
  coverImage: string;
  role: 'personal' | 'creator' | 'professional' | 'business';
  badge: '' | 'blue' | 'gold';
  subscription: string;
  isVerified: boolean;
  nameVisibility: 'public' | 'private';
  dmPermission: 'all' | 'followers' | 'paid';
  searchVisibility: 'public' | 'private';
  paidChatEnabled: boolean;
  paidChatPrice: number;
  publicKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorProfileImage: string;
  authorBadge: string;
  authorIsVerified: boolean;
  caption: string;
  mediaUrls: string;
  factCheck: string;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  content: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  user1Id: string;
  user2Id: string;
  isPaidChat: boolean;
  chatPrice: number;
  isPaidBy: string | null;
  isDeleted: boolean;
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  otherUser?: Black94User;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: 'text' | 'image' | 'video';
  mediaUrl: string | null;
  status: 'sent' | 'delivered' | 'seen';
  createdAt: string;
}

export interface Black94Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'message' | 'mention' | 'repost' | 'engagement';
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorProfileImage: string;
  postId?: string;
  message?: string;
  read: boolean;
  createdAt: string;
}

// ── Helper: Firestore Timestamp → ISO string ────────────────────────────────

function tsToISO(value: unknown): string {
  if (value && typeof value === 'object' && 'seconds' in value) {
    const ts = value as { seconds: number; nanoseconds: number };
    return new Date(ts.seconds * 1000 + ts.nanoseconds / 1_000_000).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function docToBlack94User(docSnap: DocumentSnapshot<DocumentData>): Black94User {
  const d = docSnap.data()!;
  return {
    uid: d.uid ?? docSnap.id,
    email: d.email ?? '',
    username: d.username ?? '',
    usernameLower: d.usernameLower ?? '',
    displayName: d.displayName ?? '',
    bio: d.bio ?? '',
    profileImage: d.profileImage ?? '',
    coverImage: d.coverImage ?? '',
    role: d.role ?? 'personal',
    badge: d.badge ?? 'blue',
    subscription: d.subscription ?? 'free',
    isVerified: d.isVerified ?? true,
    nameVisibility: d.nameVisibility ?? 'public',
    dmPermission: d.dmPermission ?? 'all',
    searchVisibility: d.searchVisibility ?? 'public',
    paidChatEnabled: d.paidChatEnabled ?? false,
    paidChatPrice: d.paidChatPrice ?? 0,
    publicKey: d.publicKey ?? '',
    createdAt: tsToISO(d.createdAt),
    updatedAt: tsToISO(d.updatedAt),
  };
}

export function docToPost(docSnap: DocumentSnapshot<DocumentData>): Post {
  const d = docSnap.data()!;
  return {
    id: docSnap.id,
    authorId: d.authorId ?? '',
    authorUsername: d.authorUsername ?? '',
    authorDisplayName: d.authorDisplayName ?? '',
    authorProfileImage: d.authorProfileImage ?? '',
    authorBadge: d.authorBadge ?? '',
    authorIsVerified: d.authorIsVerified ?? false,
    caption: d.caption ?? '',
    mediaUrls: (() => {
      const raw = d.mediaUrls;
      if (!raw) return '';
      if (Array.isArray(raw)) {
        const filtered = raw.map(String).filter(Boolean);
        return filtered.join(',');
      }
      const s = String(raw).trim();
      return s;
    })(),
    factCheck: d.factCheck ?? '',
    likeCount: d.likeCount ?? 0,
    commentCount: d.commentCount ?? 0,
    isLiked: d.isLiked ?? false,
    createdAt: tsToISO(d.createdAt),
    updatedAt: tsToISO(d.updatedAt),
  };
}

function docToComment(docSnap: DocumentSnapshot<DocumentData>): Comment {
  const d = docSnap.data()!;
  return {
    id: docSnap.id,
    postId: d.postId ?? '',
    authorId: d.authorId ?? '',
    authorUsername: d.authorUsername ?? '',
    authorDisplayName: d.authorDisplayName ?? '',
    content: d.content ?? '',
    createdAt: tsToISO(d.createdAt),
  };
}

function docToChat(docSnap: DocumentSnapshot<DocumentData>): Chat {
  const d = docSnap.data()!;
  return {
    id: docSnap.id,
    user1Id: d.user1Id ?? '',
    user2Id: d.user2Id ?? '',
    isPaidChat: d.isPaidChat ?? false,
    chatPrice: d.chatPrice ?? 0,
    isPaidBy: d.isPaidBy ?? null,
    isDeleted: d.isDeleted ?? false,
    unreadCount: d.unreadCount ?? 0,
    createdAt: tsToISO(d.createdAt),
    updatedAt: tsToISO(d.updatedAt),
  };
}

function docToMessage(docSnap: DocumentSnapshot<DocumentData>): Message {
  const d = docSnap.data()!;
  return {
    id: docSnap.id,
    chatId: d.chatId ?? '',
    senderId: d.senderId ?? '',
    receiverId: d.receiverId ?? '',
    content: d.content ?? '',
    messageType: d.messageType ?? 'text',
    mediaUrl: d.mediaUrl ?? null,
    status: d.status ?? 'sent',
    createdAt: tsToISO(d.createdAt),
  };
}

function docToNotification(docSnap: DocumentSnapshot<DocumentData>): Black94Notification {
  const d = docSnap.data()!;
  return {
    id: docSnap.id,
    userId: d.userId ?? '',
    type: d.type ?? 'like',
    actorId: d.actorId ?? '',
    actorName: d.actorName ?? '',
    actorUsername: d.actorUsername ?? '',
    actorProfileImage: d.actorProfileImage ?? '',
    postId: d.postId,
    message: d.message,
    read: d.read ?? false,
    createdAt: tsToISO(d.createdAt),
  };
}

// ── User Functions ──────────────────────────────────────────────────────────

export async function createUserFromGoogle(user: FirebaseUser): Promise<Black94User> {
  const userRef = doc(db, 'users', user.uid);
  const existingSnap = await getDoc(userRef);

  if (existingSnap.exists()) {
    return docToBlack94User(existingSnap);
  }

  // Generate username from email
  const email = user.email ?? '';
  const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user';

  // Check uniqueness via usernames collection
  const usernameLower = baseUsername.toLowerCase();
  let finalUsername = baseUsername;
  let finalUsernameLower = usernameLower;

  const usernameDoc = doc(db, 'usernames', usernameLower);
  const usernameSnap = await getDoc(usernameDoc);

  if (usernameSnap.exists()) {
    // Append random 4 digits
    const digits = Math.floor(1000 + Math.random() * 9000).toString();
    finalUsername = baseUsername + digits;
    finalUsernameLower = finalUsername.toLowerCase();
  }

  const now = new Date().toISOString();
  const userData: Black94User = {
    uid: user.uid,
    email: user.email ?? '',
    username: finalUsername,
    usernameLower: finalUsernameLower,
    displayName: user.displayName ?? finalUsername,
    bio: '',
    profileImage: user.photoURL ?? '',
    coverImage: '',
    role: 'personal',
    badge: 'blue',
    subscription: 'free',
    isVerified: true,
    nameVisibility: 'public',
    dmPermission: 'all',
    searchVisibility: 'public',
    paidChatEnabled: false,
    paidChatPrice: 0,
    publicKey: '',
    createdAt: now,
    updatedAt: now,
  };

  // Firestore transaction: ALL reads before ALL writes
  await runTransaction(db, async (transaction) => {
    // Read: verify username is still free
    const usernameCheckRef = doc(db, 'usernames', finalUsernameLower);
    const usernameCheckSnap = await transaction.get(usernameCheckRef);
    if (usernameCheckSnap.exists()) {
      throw new Error(`Username "${finalUsername}" is already taken`);
    }

    // Read: verify user doc doesn't exist yet
    const userCheckSnap = await transaction.get(userRef);
    if (userCheckSnap.exists()) {
      throw new Error(`User "${user.uid}" already exists`);
    }

    // Writes
    transaction.set(usernameCheckRef, { uid: user.uid });
    transaction.set(userRef, {
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return userData;
}

/**
 * Ensure the current user has an E2E encryption keypair.
 * - Generates a new X25519 keypair if none exists (stored in IndexedDB)
 * - Publishes the public key to the user's Firestore profile
 * - Called on login / app init — safe to call multiple times (idempotent)
 * - BUG 6 FIX: Deduplicates concurrent calls with a promise cache
 * Returns the public key base64 string.
 */
const e2eInitCache = new Map<string, Promise<string>>()

export async function ensureE2EKeyPair(userId: string): Promise<string> {
  // Deduplicate: if already in-flight, return the same promise
  const cached = e2eInitCache.get(userId)
  if (cached) return cached

  const promise = (async () => {
    try {
      const { publicKeyBase64 } = await getOrCreateKeyPair(userId);

      // Check if public key is already in Firestore
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      if (snap.exists() && snap.data()?.publicKey === publicKeyBase64) {
        return publicKeyBase64; // Already up to date
      }

      // Publish public key to Firestore
      await updateDoc(userRef, { publicKey: publicKeyBase64 });
      return publicKeyBase64;
    } finally {
      // Clear cache when done so future calls re-execute (e.g., after key rotation)
      e2eInitCache.delete(userId);
    }
  })();

  e2eInitCache.set(userId, promise);
  return promise;
}

export async function getUser(uid: string): Promise<Black94User | null> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return docToBlack94User(snap);
}

export async function updateUser(uid: string, data: Partial<Black94User>): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const updatePayload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  await updateDoc(userRef, updatePayload);
}

export async function checkUsernameAvailability(username: string, excludeUserId?: string): Promise<boolean> {
  const usernameLower = username.toLowerCase();

  // Check usernames collection
  const usernameRef = doc(db, 'usernames', usernameLower);
  const usernameSnap = await getDoc(usernameRef);
  if (usernameSnap.exists()) {
    // If this username doc belongs to the user we're excluding, it's still available for them
    if (excludeUserId && usernameSnap.data()?.uid === excludeUserId) {
      // Don't return false — continue to check users collection too
    } else {
      return false;
    }
  }

  // Also query users collection for usernameLower
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('usernameLower', '==', usernameLower));
  const usersSnap = await getDocs(q);
  if (!usersSnap.empty) {
    // If the only user with this username is the one we're excluding, it's available
    if (excludeUserId) {
      const otherUsers = usersSnap.docs.filter(d => d.id !== excludeUserId);
      if (otherUsers.length > 0) return false;
    } else {
      return false;
    }
  }

  return true;
}

export async function updateUsername(uid: string, newUsername: string): Promise<void> {
  const newUsernameLower = newUsername.toLowerCase();

  await runTransaction(db, async (transaction) => {
    // Reads first
    const userRef = doc(db, 'users', uid);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    const oldUsernameLower = userSnap.data()?.usernameLower as string;
    if (oldUsernameLower === newUsernameLower) return; // no change needed

    // Check new username is available
    const newUsernameRef = doc(db, 'usernames', newUsernameLower);
    const newUsernameSnap = await transaction.get(newUsernameRef);
    if (newUsernameSnap.exists()) {
      throw new Error('Username is already taken');
    }

    // Writes
    // Delete old username doc
    if (oldUsernameLower) {
      const oldUsernameRef = doc(db, 'usernames', oldUsernameLower);
      transaction.delete(oldUsernameRef);
    }
    // Create new username doc
    transaction.set(newUsernameRef, { uid });
    // Update user doc
    transaction.update(userRef, {
      username: newUsername,
      usernameLower: newUsernameLower,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Batch-update ALL posts by a user with their latest profile data.
 * This ensures feed consistency — posts always show the author's current
 * avatar, badge, and verification status (fan-out on profile write).
 */
export async function updateAuthorDataInPosts(
  uid: string,
  data: { authorProfileImage?: string; authorIsVerified?: boolean; authorBadge?: string; authorDisplayName?: string; authorUsername?: string }
): Promise<void> {
  const postsRef = collection(db, 'posts');
  const q = query(postsRef, where('authorId', '==', uid));
  const snap = await getDocs(q);

  if (snap.empty) return;

  // Firestore batch write limit is 500 operations
  let batch = writeBatch(db);
  let count = 0;

  for (const docSnap of snap.docs) {
    batch.update(docSnap.ref, data);
    count++;

    if (count % 500 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }
}

// ── Post Functions ──────────────────────────────────────────────────────────

export async function fetchFeedPosts(
  limitCount: number,
  offset?: DocumentSnapshot<DocumentData>,
): Promise<{ posts: Post[]; lastDoc: DocumentSnapshot<DocumentData> | null }> {
  const postsRef = collection(db, 'posts');
  let q = query(postsRef, orderBy('createdAt', 'desc'), firestoreLimit(limitCount));

  if (offset) {
    q = query(postsRef, orderBy('createdAt', 'desc'), startAfter(offset), firestoreLimit(limitCount));
  }

  const snap = await getDocs(q);
  const posts = snap.docs.map(docToPost);
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { posts, lastDoc };
}

export async function createPost(
  authorId: string,
  caption: string,
  mediaUrls?: string,
): Promise<Post> {
  // Fetch author info
  const author = await getUser(authorId);
  if (!author) throw new Error('Author not found');

  const postRef = await addDoc(collection(db, 'posts'), {
    authorId,
    authorUsername: author.username,
    authorDisplayName: author.displayName,
    authorProfileImage: author.profileImage,
    authorBadge: author.badge,
    authorIsVerified: author.isVerified,
    caption,
    mediaUrls: mediaUrls ?? '',
    factCheck: '',
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const snap = await getDoc(postRef);
  return docToPost(snap);
}

export async function toggleLike(postId: string, userId: string): Promise<boolean> {
  const likeRef = doc(db, 'posts', postId, 'likes', userId);
  const likeSnap = await getDoc(likeRef);
  const postRef = doc(db, 'posts', postId);

  if (likeSnap.exists()) {
    // Unlike
    await runTransaction(db, async (transaction) => {
      transaction.get(likeRef);
      transaction.get(postRef);
      transaction.delete(likeRef);
      transaction.update(postRef, { likeCount: increment(-1) });
    });
    return false;
  } else {
    // Like
    await runTransaction(db, async (transaction) => {
      transaction.get(likeRef);
      transaction.get(postRef);
      transaction.set(likeRef, { userId, createdAt: serverTimestamp() });
      transaction.update(postRef, { likeCount: increment(1) });
    });
    return true;
  }
}

export async function addComment(
  postId: string,
  userId: string,
  content: string,
): Promise<Comment> {
  const author = await getUser(userId);
  if (!author) throw new Error('User not found');

  const commentRef = await addDoc(collection(db, 'posts', postId, 'comments'), {
    postId,
    authorId: userId,
    authorUsername: author.username,
    authorDisplayName: author.displayName,
    content,
    createdAt: serverTimestamp(),
  });

  // Update comment count on post
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    commentCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  const snap = await getDoc(commentRef);
  return docToComment(snap);
}

export async function fetchUserPosts(uid: string, limitCount: number): Promise<Post[]> {
  const postsRef = collection(db, 'posts');
  const q = query(
    postsRef,
    where('authorId', '==', uid),
    orderBy('createdAt', 'desc'),
    firestoreLimit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToPost);
}

export async function deletePost(postId: string): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  // Delete the post document
  await deleteDoc(postRef);
}

// ── Follow Functions ────────────────────────────────────────────────────────

export async function toggleFollow(followerId: string, followingId: string): Promise<boolean> {
  const followRef = doc(db, 'follows', `${followerId}_${followingId}`);
  const followSnap = await getDoc(followRef);

  if (followSnap.exists()) {
    // Unfollow
    await deleteDoc(followRef);
    return false;
  } else {
    // Follow
    await setDoc(followRef, {
      followerId,
      followingId,
      createdAt: serverTimestamp(),
    });
    // Notify the followed user (fire-and-forget)
    try {
      const followerSnap = await getDoc(doc(db, 'users', followerId));
      const follower = followerSnap.exists() ? followerSnap.data() : null;
      createNotification({
        userId: followingId,
        type: 'follow',
        actorId: followerId,
        actorName: follower?.displayName || '',
        actorUsername: follower?.username || '',
        actorProfileImage: follower?.profileImage || '',
        message: 'started following you',
      });
    } catch (e) {
      console.warn('[db] toggleFollow: notification failed (non-critical):', e);
    }
    return true;
  }
}

/** Count how many users follow the given userId */
export async function getFollowerCount(userId: string): Promise<number> {
  try {
    const q = query(collection(db, 'follows'), where('followingId', '==', userId));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch {
    return 0;
  }
}

/** Count how many users the given userId follows */
export async function getFollowingCount(userId: string): Promise<number> {
  try {
    const q = query(collection(db, 'follows'), where('followerId', '==', userId));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch {
    return 0;
  }
}

/** Check if followerId follows followingId */
export async function checkIsFollowing(followerId: string, followingId: string): Promise<boolean> {
  try {
    const ref = doc(db, 'follows', `${followerId}_${followingId}`);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch {
    return false;
  }
}

// ── Chat Functions ──────────────────────────────────────────────────────────

export async function fetchChats(userId: string): Promise<Chat[]> {
  const chatsRef = collection(db, 'chats');

  const q1 = query(chatsRef, where('user1Id', '==', userId), orderBy('updatedAt', 'desc'));
  const q2 = query(chatsRef, where('user2Id', '==', userId), orderBy('updatedAt', 'desc'));

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  // Deduplicate (shouldn't normally happen but safety)
  const chatMap = new Map<string, Chat>();

  for (const snap of [snap1, snap2]) {
    for (const docSnap of snap.docs) {
      if (!chatMap.has(docSnap.id)) {
        chatMap.set(docSnap.id, docToChat(docSnap));
      }
    }
  }

  // Fetch other user info for each chat
  const chats = Array.from(chatMap.values());
  const enrichedChats = await Promise.all(
    chats.map(async (chat) => {
      const otherUserId = chat.user1Id === userId ? chat.user2Id : chat.user1Id;
      const otherUser = await getUser(otherUserId);
      return { ...chat, otherUser: otherUser ?? undefined };
    }),
  );

  return enrichedChats;
}

export async function sendMessage(
  chatId: string,
  senderId: string,
  receiverId: string,
  content: string,
  encrypted: boolean = false,
): Promise<Message> {
  const messageRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
    chatId,
    senderId,
    receiverId,
    content,
    messageType: 'text' as const,
    mediaUrl: null,
    status: 'sent' as const,
    encrypted,
    createdAt: serverTimestamp(),
  });

  // Update chat's updatedAt
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    updatedAt: serverTimestamp(),
  });

  const snap = await getDoc(messageRef);
  return docToMessage(snap);
}

export async function fetchMessages(chatId: string, limitCount: number): Promise<Message[]> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(
    messagesRef,
    orderBy('createdAt', 'desc'),
    firestoreLimit(limitCount),
  );
  const snap = await getDocs(q);
  // Return in chronological order (oldest first)
  return snap.docs.map(docToMessage).reverse();
}

// ── Notification Functions ──────────────────────────────────────────────────

export async function createNotification(data: {
  userId: string
  type: 'like' | 'comment' | 'follow' | 'message' | 'mention' | 'repost' | 'engagement'
  actorId: string
  actorName: string
  actorUsername: string
  actorProfileImage: string
  postId?: string
  message?: string
}): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: data.userId,
      type: data.type,
      actorId: data.actorId,
      actorName: data.actorName,
      actorUsername: data.actorUsername,
      actorProfileImage: data.actorProfileImage,
      postId: data.postId || null,
      message: data.message || '',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[notifications] Failed to create notification:', err);
  }
}

export async function fetchNotifications(userId: string): Promise<Black94Notification[]> {
  const notifsRef = collection(db, 'notifications');
  const q = query(
    notifsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToNotification);
}

export async function markNotificationRead(notifId: string): Promise<void> {
  const notifRef = doc(db, 'notifications', notifId);
  await updateDoc(notifRef, { read: true });
}

// ── Search Functions ────────────────────────────────────────────────────────

export async function searchUsers(queryStr: string, limitCount: number): Promise<Black94User[]> {
  const usersRef = collection(db, 'users');

  // Search by username prefix
  const qUsername = query(
    usersRef,
    where('usernameLower', '>=', queryStr.toLowerCase()),
    where('usernameLower', '<=', queryStr.toLowerCase() + '\uf8ff'),
    firestoreLimit(limitCount),
  );

  // Search by displayName prefix
  const qDisplay = query(
    usersRef,
    where('displayName', '>=', queryStr),
    where('displayName', '<=', queryStr + '\uf8ff'),
    firestoreLimit(limitCount),
  );

  const [snapUsername, snapDisplay] = await Promise.all([getDocs(qUsername), getDocs(qDisplay)]);

  // Deduplicate by uid
  const userMap = new Map<string, Black94User>();
  for (const docSnap of snapUsername.docs) {
    userMap.set(docSnap.id, docToBlack94User(docSnap));
  }
  for (const docSnap of snapDisplay.docs) {
    if (!userMap.has(docSnap.id)) {
      userMap.set(docSnap.id, docToBlack94User(docSnap));
    }
  }

  return Array.from(userMap.values()).slice(0, limitCount);
}

export async function searchPosts(queryStr: string, limitCount: number): Promise<Post[]> {
  const postsRef = collection(db, 'posts');
  const q = query(
    postsRef,
    where('caption', '>=', queryStr),
    where('caption', '<=', queryStr + '\uf8ff'),
    orderBy('createdAt', 'desc'),
    firestoreLimit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToPost);
}

// ── Story Functions ─────────────────────────────────────────────────────────

export interface Story {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorProfileImage: string;
  authorIsVerified: boolean;
  format: string;
  content: string;
  mediaUrl: string;           // gradient for text, image URL for feed/festival
  language: string;
  pollOptions?: Array<{ id: string; text: string; votes: number; percentage: number }>;
  voiceUrl?: string;          // Firebase Storage URL for voice audio
  voiceDuration?: number;
  voiceWaveform?: number[];
  festivalTemplate?: { id: string; name: string; gradient: string; emoji: string; textColor: string };
  cricketData?: { team1: string; team2: string; team1Score: string; team2Score: string; overs: string; venue: string; status: string };
  audience: string;
  expiry: string;
  viewCount: number;
  createdAt: string;
}

function docToStory(docSnap: DocumentSnapshot<DocumentData>): Story {
  const d = docSnap.data()!;
  return {
    id: docSnap.id,
    authorId: d.authorId ?? '',
    authorUsername: d.authorUsername ?? '',
    authorDisplayName: d.authorDisplayName ?? '',
    authorProfileImage: d.authorProfileImage ?? '',
    authorIsVerified: d.authorIsVerified ?? false,
    format: d.format ?? 'text',
    content: d.content ?? '',
    mediaUrl: d.mediaUrl ?? '',
    language: d.language ?? 'en',
    pollOptions: d.pollOptions,
    voiceUrl: d.voiceUrl,
    voiceDuration: d.voiceDuration,
    voiceWaveform: d.voiceWaveform,
    festivalTemplate: d.festivalTemplate,
    cricketData: d.cricketData,
    audience: d.audience ?? 'everyone',
    expiry: d.expiry ?? '24h',
    viewCount: d.viewCount ?? 0,
    createdAt: tsToISO(d.createdAt),
  };
}

export interface StoryAuthorInfo {
  authorUsername: string;
  authorDisplayName: string;
  authorProfileImage: string;
  authorIsVerified: boolean;
}

/**
 * Create a new story in Firestore.
 * Returns the created story document.
 * If authorInfo is provided, skips the extra getUser() Firestore read for speed.
 */
export async function createStory(
  authorId: string,
  data: {
    format: string;
    content: string;
    mediaUrl?: string;
    language?: string;
    pollOptions?: Array<{ id: string; text: string; votes: number; percentage: number }>;
    voiceUrl?: string;
    voiceDuration?: number;
    voiceWaveform?: number[];
    festivalTemplate?: { id: string; name: string; gradient: string; emoji: string; textColor: string };
    cricketData?: { team1: string; team2: string; team1Score: string; team2Score: string; overs: string; venue: string; status: string };
    audience?: string;
    expiry?: string;
  },
  authorInfo?: StoryAuthorInfo,
): Promise<Story> {
  // Use provided author info if available (avoids extra Firestore read)
  const author = authorInfo ?? await getUser(authorId);
  if (!author) throw new Error('Author not found');

  const username = typeof author === 'string' ? author : author.authorUsername;
  const displayName = typeof author === 'string' ? author : author.authorDisplayName;
  const profileImage = typeof author === 'string' ? '' : author.authorProfileImage;
  const isVerified = typeof author === 'string' ? false : author.authorIsVerified;

  const storyRef = await addDoc(collection(db, 'stories'), {
    authorId,
    authorUsername: username,
    authorDisplayName: displayName,
    authorProfileImage: profileImage,
    authorIsVerified: isVerified,
    format: data.format,
    content: data.content,
    mediaUrl: data.mediaUrl ?? '',
    language: data.language ?? 'en',
    pollOptions: data.pollOptions ?? null,
    voiceUrl: data.voiceUrl ?? null,
    voiceDuration: data.voiceDuration ?? null,
    voiceWaveform: data.voiceWaveform ?? null,
    festivalTemplate: data.festivalTemplate ?? null,
    cricketData: data.cricketData ?? null,
    audience: data.audience ?? 'everyone',
    expiry: data.expiry ?? '24h',
    viewCount: 0,
    createdAt: serverTimestamp(),
  });

  const snap = await getDoc(storyRef);
  return docToStory(snap);
}

/**
 * Fetch recent stories from Firestore (for the story feed).
 * Stories are fetched in reverse chronological order.
 */
export async function fetchStories(limitCount: number): Promise<Story[]> {
  const storiesRef = collection(db, 'stories');
  const q = query(
    storiesRef,
    orderBy('createdAt', 'desc'),
    firestoreLimit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToStory);
}
