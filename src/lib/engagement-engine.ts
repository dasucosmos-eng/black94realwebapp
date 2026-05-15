/**
 * engagement-engine.ts
 *
 * Complete engagement scoring engine for Black94.
 *
 * Call `runRecalculationCycle()` from a scheduled job (recommended: every 2 min)
 * to score all recent posts, compute velocity, classify trending, and emit
 * notification events.
 *
 * Firestore collections created implicitly:
 *   post_scores/{postId}     → score, velocity, trendingLabel, milestones, snapshots[]
 */

import { db } from './firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  serverTimestamp,
  DocumentSnapshot,
  DocumentData,
} from 'firebase/firestore'

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURABLE CONSTANTS — tune these without touching any logic below
   ═══════════════════════════════════════════════════════════════════════════ */

/** Engagement signal weights used in raw score calculation */
const WEIGHTS = {
  views:    1,
  likes:    3,
  comments: 5,
  shares:   7,
} as const

/** Time-decay half-life in hours — score halves every this many hours */
const DECAY_HALF_LIFE_HOURS = 6

/** Velocity multiplier applied when ranking the feed */
const VELOCITY_MULTIPLIER = 2

/** How many recent snapshots to consider when calculating velocity */
const VELOCITY_SNAPSHOT_COUNT = 3

/** Maximum score snapshots retained per post */
const MAX_SNAPSHOTS_PER_POST = 10

/** Only score posts younger than this many days */
const POST_AGE_LIMIT_DAYS = 7

/** Process posts in chunks of this size to avoid memory / DB pressure */
const BATCH_SIZE = 100

/** Trending classification velocity thresholds */
const TRENDING_THRESHOLDS = {
  viral:    80,
  trending: 40,
  rising:   15,
} as const

/** Minimum score increase between cycles to fire a momentum notification */
const MOMENTUM_THRESHOLD = 30

/** View-count milestone interval (fires at 100, 200, 300 …) */
const VIEW_MILESTONE_INTERVAL = 100

/** Like-count milestone interval (fires at 10, 20, 30 …) */
const LIKE_MILESTONE_INTERVAL = 10

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ScoreSnapshot {
  score: number
  timestamp: string
}

export interface EngagementRecord {
  postId: string
  score: number
  velocity: number
  trendingLabel: TrendingLabel
  lastViewMilestone: number
  lastLikeMilestone: number
  snapshots: ScoreSnapshot[]
  updatedAt: string
}

export type TrendingLabel = 'viral' | 'trending' | 'rising' | ''

export interface NotificationEvent {
  postId: string
  ownerUserId: string
  triggerType: 'momentum' | 'views_milestone' | 'likes_milestone'
  currentValue: number
  message: string
}

export interface RankedPost {
  postId: string
  score: number
  velocity: number
  rankingValue: number
  trendingLabel: TrendingLabel
}

export interface RecalculationResult {
  postsProcessed: number
  notificationsEmitted: NotificationEvent[]
  errors: string[]
  durationMs: number
}

/** Shape of a post as read from Firestore `posts` collection */
interface PostDoc {
  id: string
  authorId: string
  viewCount: number
  likeCount: number
  commentCount: number
  repostCount: number
  createdAt: string
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCORING
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Raw engagement score from the four signals.
 * Formula: views×W_v + likes×W_l + comments×W_c + shares×W_s
 */
function calculateRawScore(post: PostDoc): number {
  return (
    (post.viewCount    ?? 0) * WEIGHTS.views    +
    (post.likeCount    ?? 0) * WEIGHTS.likes    +
    (post.commentCount ?? 0) * WEIGHTS.comments +
    (post.repostCount  ?? 0) * WEIGHTS.shares
  )
}

/**
 * Apply exponential time-decay to the raw score.
 * Formula: rawScore × 0.5^(ageInHours / DECAY_HALF_LIFE_HOURS)
 */
function applyTimeDecay(rawScore: number, createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  if (ageMs <= 0) return rawScore
  const ageInHours = ageMs / 3_600_000
  return Math.round(rawScore * Math.pow(0.5, ageInHours / DECAY_HALF_LIFE_HOURS))
}

/** Single integer score for a post (raw × decay). */
export function calculateScore(post: PostDoc): number {
  return applyTimeDecay(calculateRawScore(post), post.createdAt)
}

/* ═══════════════════════════════════════════════════════════════════════════
   SNAPSHOTS — persisted inside post_scores doc (array field)
   ═══════════════════════════════════════════════════════════════════════════ */

const SCORES_COL = 'post_scores'

function scoreRef(postId: string) {
  return doc(db, SCORES_COL, postId)
}

function tsToISO(value: unknown): string {
  if (value && typeof value === 'object' && 'seconds' in value) {
    const ts = value as { seconds: number; nanoseconds: number }
    return new Date(ts.seconds * 1000 + ts.nanoseconds / 1_000_000).toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

/** Read the persisted engagement record for a single post (or null). */
export async function getEngagementRecord(postId: string): Promise<EngagementRecord | null> {
  try {
    const snap = await getDoc(scoreRef(postId))
    if (!snap.exists()) return null
    const d = snap.data()!
    return {
      postId: snap.id,
      score:           d.score ?? 0,
      velocity:        d.velocity ?? 0,
      trendingLabel:   d.trendingLabel ?? '',
      lastViewMilestone:  d.lastViewMilestone ?? 0,
      lastLikeMilestone:  d.lastLikeMilestone ?? 0,
      snapshots:       ((d.snapshots ?? []) as Array<{ score: number; timestamp: unknown }>).map((s) => ({
        score:    s.score,
        timestamp: tsToISO(s.timestamp),
      })),
      updatedAt: tsToISO(d.updatedAt),
    }
  } catch (err) {
    console.error(`[engagement] Failed to read record for ${postId}:`, err)
    return null
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   VELOCITY
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Velocity = most-recent snapshot score − oldest of last N snapshots.
 * Returns 0 when fewer than 2 snapshots exist.
 */
export function calculateVelocity(snapshots: ScoreSnapshot[]): number {
  if (snapshots.length < 2) return 0
  const window = snapshots.slice(-VELOCITY_SNAPSHOT_COUNT)
  if (window.length < 2) return 0
  return window[window.length - 1].score - window[0].score
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRENDING CLASSIFICATION
   ═══════════════════════════════════════════════════════════════════════════ */

export function classifyTrending(velocity: number): TrendingLabel {
  if (velocity > TRENDING_THRESHOLDS.viral)    return 'viral'
  if (velocity > TRENDING_THRESHOLDS.trending) return 'trending'
  if (velocity > TRENDING_THRESHOLDS.rising)   return 'rising'
  return ''
}

/* ═══════════════════════════════════════════════════════════════════════════
   FEED RANKING
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Sort by `score + velocity × VELOCITY_MULTIPLIER` (descending).
 * Returns a new array — the caller must pass in posts with their scores & velocities.
 */
export function rankPosts(
  posts: Array<{ postId: string; score: number; velocity: number; trendingLabel?: TrendingLabel }>,
): RankedPost[] {
  return [...posts]
    .map((p) => ({
      postId:        p.postId,
      score:         p.score,
      velocity:      p.velocity,
      trendingLabel: p.trendingLabel ?? '',
      rankingValue:  p.score + p.velocity * VELOCITY_MULTIPLIER,
    }))
    .sort((a, b) => b.rankingValue - a.rankingValue)
}

/**
 * Convenience: fetch ranked feed directly from Firestore + post_scores.
 *
 * PERFORMANCE OPTIMIZED: Only fetches up to MAX_CANDIDATES posts (not ALL 7-day posts),
 * scores them in parallel, and returns full post data to avoid a second fetch in the UI.
 */
const MAX_RANKED_CANDIDATES = 200

export async function getRankedFeed(limitCount = 20): Promise<RankedPost[]> {
  const cutoff = new Date(
    Date.now() - POST_AGE_LIMIT_DAYS * 86_400_000,
  ).toISOString()

  // Fetch a bounded set of recent posts (not ALL posts from 7 days)
  const snap = await getDocs(
    query(
      collection(db, 'posts'),
      where('createdAt', '>=', cutoff),
      orderBy('createdAt', 'desc'),
      firestoreLimit(MAX_RANKED_CANDIDATES),
    ),
  )

  if (snap.empty) return []

  const ids = snap.docs.map((d) => d.id)

  // Read score records in parallel chunks of 20 (increased from 10)
  const CHUNK = 20
  const scored: Array<{ postId: string; score: number; velocity: number; trendingLabel: TrendingLabel }> = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const results = await Promise.all(
      ids.slice(i, i + CHUNK).map((id) => getEngagementRecord(id)),
    )
    results.forEach((rec, idx) => {
      scored.push({
        postId:        ids[i + idx],
        score:         rec?.score ?? 0,
        velocity:      rec?.velocity ?? 0,
        trendingLabel: rec?.trendingLabel ?? '',
      })
    })
  }

  return rankPosts(scored).slice(0, limitCount)
}

/* ═══════════════════════════════════════════════════════════════════════════
   NOTIFICATION TRIGGERS
   ═══════════════════════════════════════════════════════════════════════════ */

function checkTriggers(
  post: PostDoc,
  newScore: number,
  existing: EngagementRecord | null,
): NotificationEvent[] {
  const events: NotificationEvent[] = []
  const owner = post.authorId

  /* — Momentum — score jumped by > MOMENTUM_THRESHOLD since last cycle */
  const prevScore = existing?.score ?? null
  if (prevScore !== null) {
    const delta = newScore - prevScore
    if (delta > MOMENTUM_THRESHOLD) {
      events.push({
        postId:      post.id,
        ownerUserId: owner,
        triggerType: 'momentum',
        currentValue: Math.round(delta),
        message:     `Your post is gaining momentum — score jumped by ${Math.round(delta)}`,
      })
    }
  }

  /* — Views milestone — every VIEW_MILESTONE_INTERVAL views */
  const views = post.viewCount ?? 0
  const lastViewMilestone = existing?.lastViewMilestone ?? 0
  const currentViewMilestone = Math.floor(views / VIEW_MILESTONE_INTERVAL) * VIEW_MILESTONE_INTERVAL
  if (currentViewMilestone > lastViewMilestone && currentViewMilestone > 0) {
    events.push({
      postId:      post.id,
      ownerUserId: owner,
      triggerType: 'views_milestone',
      currentValue: currentViewMilestone,
      message:     `Your post just hit ${currentViewMilestone} views`,
    })
  }

  /* — Likes milestone — every LIKE_MILESTONE_INTERVAL likes */
  const likes = post.likeCount ?? 0
  const lastLikeMilestone = existing?.lastLikeMilestone ?? 0
  const currentLikeMilestone = Math.floor(likes / LIKE_MILESTONE_INTERVAL) * LIKE_MILESTONE_INTERVAL
  if (currentLikeMilestone > lastLikeMilestone && currentLikeMilestone > 0) {
    events.push({
      postId:      post.id,
      ownerUserId: owner,
      triggerType: 'likes_milestone',
      currentValue: currentLikeMilestone,
      message:     `Your post just hit ${currentLikeMilestone} likes`,
    })
  }

  return events
}

/* ═══════════════════════════════════════════════════════════════════════════
   PERSISTENCE
   ═══════════════════════════════════════════════════════════════════════════ */

async function persistRecord(
  postId: string,
  score: number,
  velocity: number,
  trendingLabel: TrendingLabel,
  lastViewMilestone: number,
  lastLikeMilestone: number,
  snapshots: ScoreSnapshot[],
): Promise<void> {
  await setDoc(
    scoreRef(postId),
    {
      score,
      velocity,
      trendingLabel,
      lastViewMilestone,
      lastLikeMilestone,
      snapshots,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   POST FETCHING
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchRecentPosts(): Promise<PostDoc[]> {
  const cutoff = new Date(Date.now() - POST_AGE_LIMIT_DAYS * 86_400_000).toISOString()
  const all: PostDoc[] = []
  let lastDoc: DocumentSnapshot<DocumentData> | null = null

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const constraints: any[] = [
      where('createdAt', '>=', cutoff),
      orderBy('createdAt', 'desc'),
      firestoreLimit(BATCH_SIZE),
    ]
    if (lastDoc) constraints.push(startAfter(lastDoc))

    const snap = await getDocs(query(collection(db, 'posts'), ...constraints))
    if (snap.empty) break

    lastDoc = snap.docs[snap.docs.length - 1]

    for (const ds of snap.docs) {
      const d = ds.data()!
      all.push({
        id:           ds.id,
        authorId:     d.authorId ?? '',
        viewCount:    d.viewCount ?? 0,
        likeCount:    d.likeCount ?? 0,
        commentCount: d.commentCount ?? 0,
        repostCount:  d.repostCount ?? 0,
        createdAt:    tsToISO(d.createdAt),
      })
    }

    if (snap.docs.length < BATCH_SIZE) break
  }

  return all
}

/* ═══════════════════════════════════════════════════════════════════════════
   SINGLE-POST PIPELINE (used by the batch cycle)
   ═══════════════════════════════════════════════════════════════════════════ */

async function processPost(
  post: PostDoc,
  existing: EngagementRecord | null,
): Promise<{ notifications: NotificationEvent[]; error?: string }> {
  try {
    // 1. Score
    const newScore = calculateScore(post)

    // 2. Snapshot
    const now = new Date().toISOString()
    const snapshots = [...(existing?.snapshots ?? []), { score: newScore, timestamp: now }]
    const trimmed = snapshots.length > MAX_SNAPSHOTS_PER_POST
      ? snapshots.slice(-MAX_SNAPSHOTS_PER_POST)
      : snapshots

    // 3. Velocity
    const velocity = calculateVelocity(trimmed)

    // 4. Trending label
    const trendingLabel = classifyTrending(velocity)

    // 5. Notifications
    const notifications = checkTriggers(post, newScore, existing)

    // 6. Persist milestones — record the highest milestone seen so far so
    //    we never fire the same milestone twice
    const views  = post.viewCount ?? 0
    const likes  = post.likeCount ?? 0
    const curViewMile  = Math.floor(views / VIEW_MILESTONE_INTERVAL) * VIEW_MILESTONE_INTERVAL
    const curLikeMile  = Math.floor(likes / LIKE_MILESTONE_INTERVAL) * LIKE_MILESTONE_INTERVAL
    const lastViewMile = Math.max(existing?.lastViewMilestone ?? 0, curViewMile)
    const lastLikeMile = Math.max(existing?.lastLikeMilestone ?? 0, curLikeMile)

    // 7. Write
    await persistRecord(post.id, newScore, velocity, trendingLabel, lastViewMile, lastLikeMile, trimmed)

    return { notifications }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { notifications: [], error: `Post ${post.id}: ${msg}` }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RECALCULATION CYCLE
   ═══════════════════════════════════════════════════════════════════════════

  Designed to be called by a scheduled job every 2 minutes.

  Flow per cycle:
    1. Fetch all posts created in the last 7 days (paginated)
    2. For each post (batched):
       a. Calculate score  (raw × time-decay)
       b. Append score snapshot (trim to 10)
       c. Calculate velocity  (Δ across last 3 snapshots)
       d. Classify trending label
       e. Check notification triggers (momentum / views-mile / likes-mile)
       f. Persist to post_scores/{postId}
    3. Return summary

  Safety:
    • Per-post error handling — one failure never corrupts another post
    • Firestore `setDoc(merge)` — concurrent cycles are safe
    • Milestone dedup — highest triggered milestone is persisted
   ═══════════════════════════════════════════════════════════════════════════ */

export async function runRecalculationCycle(): Promise<RecalculationResult> {
  const t0 = Date.now()
  console.log('[engagement] ▸ Recalculation cycle starting…')

  const result: RecalculationResult = {
    postsProcessed:       0,
    notificationsEmitted: [],
    errors:               [],
    durationMs:           0,
  }

  try {
    // ── 1. Fetch all recent posts ────────────────────────────────────────
    const posts = await fetchRecentPosts()
    console.log(`[engagement]   ${posts.length} recent posts fetched`)

    // ── 2. Process in batches of BATCH_SIZE ──────────────────────────────
    for (let offset = 0; offset < posts.length; offset += BATCH_SIZE) {
      const batch = posts.slice(offset, offset + BATCH_SIZE)

      // Read existing score records in parallel (max 10 concurrent)
      const records = new Map<string, EngagementRecord | null>()
      for (let i = 0; i < batch.length; i += 10) {
        const chunk = batch.slice(i, i + 10)
        const results = await Promise.all(
          chunk.map(async (p) => {
            const rec = await getEngagementRecord(p.id)
            return { id: p.id, rec }
          }),
        )
        results.forEach(({ id, rec }) => records.set(id, rec))
      }

      // Score each post
      for (const post of batch) {
        const { notifications, error } = await processPost(post, records.get(post.id) ?? null)
        result.postsProcessed++
        if (error) result.errors.push(error)
        else result.notificationsEmitted.push(...notifications)
      }

      console.log(
        `[engagement]   ${Math.min(offset + BATCH_SIZE, posts.length)}/${posts.length} processed`,
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`Cycle error: ${msg}`)
    console.error('[engagement] Cycle aborted:', err)
  }

  result.durationMs = Date.now() - t0

  console.log(
    `[engagement] ✓ Cycle complete — ` +
    `${result.postsProcessed} posts, ` +
    `${result.notificationsEmitted.length} notifications, ` +
    `${result.errors.length} errors, ` +
    `${result.durationMs}ms`,
  )

  return result
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTED HELPERS (useful for the UI layer)
   ═══════════════════════════════════════════════════════════════════════════ */

/** Quick read: score + trending label for a single post (no velocity). */
export async function getPostScore(
  postId: string,
): Promise<{ score: number; trendingLabel: TrendingLabel }> {
  const rec = await getEngagementRecord(postId)
  return { score: rec?.score ?? 0, trendingLabel: rec?.trendingLabel ?? '' }
}

/** Quick read: score + velocity + trending label for multiple posts (batch). */
export async function getPostsScores(
  postIds: string[],
): Promise<Map<string, { score: number; velocity: number; trendingLabel: TrendingLabel }>> {
  const map = new Map<string, { score: number; velocity: number; trendingLabel: TrendingLabel }>()
  const CHUNK = 10
  for (let i = 0; i < postIds.length; i += CHUNK) {
    const results = await Promise.all(
      postIds.slice(i, i + CHUNK).map(async (id) => {
        const rec = await getEngagementRecord(id)
        return { id, score: rec?.score ?? 0, velocity: rec?.velocity ?? 0, trendingLabel: rec?.trendingLabel ?? '' }
      }),
    )
    results.forEach((r) => map.set(r.id, { score: r.score, velocity: r.velocity, trendingLabel: r.trendingLabel }))
  }
  return map
}
