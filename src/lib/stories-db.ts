/* ── Stories Firestore CRUD ─────────────────────────────────────────────────── */
/* Stores compressed JPEG base64 in Firestore documents directly.
   No composite indexes required — all queries use single-field filters only.
   Client-side sorting handles ordering.                                  */

import {
  db,
} from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  Timestamp,
  limit as firestoreLimit,
} from 'firebase/firestore';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Story {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  profileImage: string;
  verified: boolean;
  mediaUrl: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoryGroup {
  userId: string;
  username: string;
  displayName: string;
  profileImage: string;
  verified: boolean;
  stories: Pick<Story, 'id' | 'mediaUrl' | 'caption' | 'createdAt'>[];
  latestCreatedAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tsToISO(value: unknown): string {
  if (value && typeof value === 'object' && 'seconds' in value) {
    const ts = value as { seconds: number; nanoseconds: number };
    return new Date(ts.seconds * 1000 + ts.nanoseconds / 1_000_000).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function twentyFourHoursFromNow() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

// ── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Create a new story. Stores compressed base64 JPEG directly in Firestore.
 */
export async function createStory(params: {
  userId: string;
  username: string;
  displayName: string;
  profileImage: string;
  verified: boolean;
  mediaUrl: string;
  caption: string;
}): Promise<Story> {
  console.log('[stories-db] createStory → userId:', params.userId, 'base64 size:', Math.round(params.mediaUrl.length / 1024), 'KB');

  const now = new Date();
  const expiresAt = twentyFourHoursFromNow();

  const ref = await addDoc(collection(db, 'stories'), {
    userId: params.userId,
    username: params.username,
    displayName: params.displayName,
    profileImage: params.profileImage,
    verified: params.verified,
    mediaUrl: params.mediaUrl,
    caption: params.caption,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  console.log('[stories-db] Firestore write ✅ → storyId:', ref.id);

  return {
    id: ref.id,
    ...params,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Fetch all active (non-expired) stories from Firestore, grouped by user.
 * Uses ONLY single-field query (no orderBy) — works without composite indexes.
 * Sorts client-side.
 */
export async function fetchStoryGroups(): Promise<StoryGroup[]> {
  console.log('[stories-db] fetchStoryGroups → fetching…');

  const snap = await getDocs(
    query(collection(db, 'stories'), firestoreLimit(200))
  );
  console.log('[stories-db] fetchStoryGroups → raw docs:', snap.docs.length);

  const now = Date.now();
  const groupMap = new Map<string, StoryGroup>();

  for (const docSnap of snap.docs) {
    const d = docSnap.data()!;
    const createdAt = tsToISO(d.createdAt);
    const expiresAt = tsToISO(d.expiresAt);

    if (new Date(expiresAt).getTime() < now) continue;

    const userId: string = d.userId ?? '';

    if (!groupMap.has(userId)) {
      groupMap.set(userId, {
        userId,
        username: d.username ?? '',
        displayName: d.displayName ?? '',
        profileImage: d.profileImage ?? '',
        verified: d.verified ?? false,
        stories: [],
        latestCreatedAt: createdAt,
      });
    }

    groupMap.get(userId)!.stories.push({
      id: docSnap.id,
      mediaUrl: d.mediaUrl ?? '',
      caption: d.caption ?? '',
      createdAt,
    });
  }

  // Sort groups by latest story, and stories within each group by time
  const groups = Array.from(groupMap.values())
    .map((g) => ({
      ...g,
      stories: [...g.stories].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    }))
    .sort(
      (a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime()
    );

  console.log('[stories-db] fetchStoryGroups ✅ → groups:', groups.length);
  return groups;
}

/**
 * Fetch stories for a specific user.
 * Uses ONLY single-field where filter — works without composite indexes.
 * Sorts client-side.
 */
export async function fetchUserStories(userId: string): Promise<Story[]> {
  console.log('[stories-db] fetchUserStories → userId:', userId);

  // Simple query: where userId == X only — single-field index, always works
  const snap = await getDocs(
    query(
      collection(db, 'stories'),
      where('userId', '==', userId),
      firestoreLimit(50),
    )
  );

  const now = Date.now();
  const stories = snap.docs
    .map((docSnap) => {
      const d = docSnap.data()!;
      return {
        id: docSnap.id,
        userId: d.userId ?? '',
        username: d.username ?? '',
        displayName: d.displayName ?? '',
        profileImage: d.profileImage ?? '',
        verified: d.verified ?? false,
        mediaUrl: d.mediaUrl ?? '',
        caption: d.caption ?? '',
        createdAt: tsToISO(d.createdAt),
        expiresAt: tsToISO(d.expiresAt),
      };
    })
    .filter((s) => new Date(s.expiresAt).getTime() > now)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  console.log('[stories-db] fetchUserStories ✅ →', stories.length, 'stories');
  return stories;
}

export async function deleteStory(storyId: string): Promise<void> {
  await deleteDoc(doc(db, 'stories', storyId));
}
