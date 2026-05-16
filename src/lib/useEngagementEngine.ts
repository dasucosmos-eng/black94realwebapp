'use client'

import { useEffect, useRef } from 'react'
import { runRecalculationCycle, getRankedFeed } from './engagement-engine'
import type { RankedPost } from './engagement-engine'
import { createNotification } from './db'

/**
 * Client-side engagement engine hook.
 *
 * Since Black94 is a static export app with no server-side functions,
 * we run the recalculation cycle on a client-side interval.
 *
 * - Starts a cycle immediately on mount
 * - Repeats every 3 minutes (300,000ms)
 * - Only one cycle runs at a time (mutex via `running` ref)
 * - Cleans up on unmount
 */
export function useEngagementEngine(enabled = true) {
  const runningRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  const runCycle = async () => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      const result = await runRecalculationCycle()
      if (result.notificationsEmitted.length > 0) {
        console.log(`[engagement] ${result.notificationsEmitted.length} notification events fired`)
        // Write engagement notification events to Firestore
        for (const evt of result.notificationsEmitted) {
          try {
            createNotification({
              userId: evt.ownerUserId,
              type: 'engagement',
              actorId: evt.ownerUserId,
              actorName: 'Engagement',
              actorUsername: 'system',
              actorProfileImage: '',
              postId: evt.postId,
              message: evt.message || 'Your post is gaining traction!',
            })
          } catch (notifErr) {
            console.warn('[engagement] Failed to write notification:', notifErr)
          }
        }
      }
    } catch (err) {
      console.error('[engagement] Cycle error:', err)
    } finally {
      runningRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled) return

    // Run first cycle after 30s delay (let initial feed load finish first)
    const initialTimer = setTimeout(() => {
      runCycle()
    }, 30_000)

    // Then repeat every 3 minutes
    timerRef.current = setInterval(() => {
      runCycle()
    }, 180_000)

    return () => {
      clearTimeout(initialTimer)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [enabled])
}

/**
 * Fetch the ranked feed for "Discover" tab.
 * Falls back to chronological if engagement scores don't exist yet.
 */
export async function fetchRankedFeedPosts(limitCount = 20): Promise<RankedPost[]> {
  try {
    return await getRankedFeed(limitCount)
  } catch (err) {
    console.error('[engagement] Failed to fetch ranked feed:', err)
    return []
  }
}
