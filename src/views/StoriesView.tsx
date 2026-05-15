'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import StoryFeed from '@/components/stories/StoryFeed'
import StoryCreator from '@/components/stories/StoryCreator'
import StoryViewer from '@/components/stories/StoryViewer'
import { type StoryGroup, type StoryCard } from '@/lib/story-data'
import { fetchStories, type Story as FirestoreStory } from '@/lib/db'
import { useAppStore } from '@/stores/app'

export function StoriesView() {
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([])
  const [viewingGroupId, setViewingGroupId] = useState<string | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const fetchInProgressRef = useRef(false)

  const user = useAppStore((s) => s.user)

  // Fetch real stories from Firestore
  const loadStories = useCallback(async () => {
    if (fetchInProgressRef.current) return
    fetchInProgressRef.current = true
    try {
      const stories = await fetchStories(50)

      // Convert Firestore stories into StoryGroups (grouped by authorId)
      const authorMap = new Map<string, {
        stories: StoryCard[]
        authorId: string
        authorUsername: string
        authorDisplayName: string
        authorProfileImage: string
        authorIsVerified: boolean
        latestCreatedAt: string
      }>()

      for (const s of stories) {
        const existing = authorMap.get(s.authorId)
        const storyCard: StoryCard = {
          id: s.id,
          format: s.format as StoryCard['format'],
          content: s.content,
          mediaUrl: s.mediaUrl || undefined,
          language: s.language as StoryCard['language'],
          pollOptions: s.pollOptions as StoryCard['pollOptions'],
          festivalTemplate: s.festivalTemplate as StoryCard['festivalTemplate'],
          cricketData: s.cricketData as StoryCard['cricketData'],
          voiceWaveform: s.voiceWaveform,
          voiceDuration: s.voiceDuration,
        }

        if (existing) {
          existing.stories.push(storyCard)
          if (s.createdAt > existing.latestCreatedAt) {
            existing.latestCreatedAt = s.createdAt
          }
        } else {
          authorMap.set(s.authorId, {
            stories: [storyCard],
            authorId: s.authorId,
            authorUsername: s.authorUsername,
            authorDisplayName: s.authorDisplayName,
            authorProfileImage: s.authorProfileImage,
            authorIsVerified: s.authorIsVerified,
            latestCreatedAt: s.createdAt,
          })
        }
      }

      // Convert to StoryGroup format
      const firestoreGroups: StoryGroup[] = Array.from(authorMap.values()).map((a) => ({
        creatorId: a.authorId,
        creatorName: a.authorDisplayName || a.authorUsername,
        creatorHandle: a.authorUsername,
        creatorAvatar: a.authorProfileImage || '',
        creatorVerified: a.authorIsVerified,
        creatorCountry: '🇮🇳',
        creatorLanguages: ['en'],
        viewed: false,
        stories: a.stories,
        createdAt: a.latestCreatedAt,
        viewCount: 1,
        tippingEnabled: false,
        reactions: {
          agree: 0,
          disagree: 0,
          fire: 0,
          skull: 0,
          mindblown: 0,
          clapping: 0,
        },
      }))

      setStoryGroups(firestoreGroups)
    } catch (err) {
      console.warn('Failed to load stories from Firestore, showing empty state:', err)
    } finally {
      setLoading(false)
      fetchInProgressRef.current = false
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    loadStories()
  }, [loadStories])

  // Find the index of a group by creatorId in the original array
  const viewingGroupIndex = useMemo(() => {
    if (!viewingGroupId) return null
    return storyGroups.findIndex((g) => g.creatorId === viewingGroupId)
  }, [viewingGroupId, storyGroups])

  const handleOpenStory = useCallback((groupId: string) => {
    setViewingGroupId(groupId)
  }, [])

  const handleCloseStory = useCallback(() => {
    setViewingGroupId(null)
  }, [])

  const handleOpenCreator = useCallback(() => {
    setCreatorOpen(true)
  }, [])

  const handleCloseCreator = useCallback(() => {
    setCreatorOpen(false)
  }, [])

  const handleStoryPublished = useCallback((story: StoryCard) => {
    // Use the real user ID (not synthetic self_XYZ) so the group is consistent
    const authorId = user?.id || `self_${Date.now()}`

    const newGroup: StoryGroup = {
      creatorId: authorId,
      creatorName: user?.displayName || user?.username || 'You',
      creatorHandle: user?.username || 'you',
      creatorAvatar: user?.profileImage || '',
      creatorVerified: user?.isVerified || false,
      creatorCountry: '🇮🇳',
      creatorLanguages: ['en'],
      viewed: true,
      stories: [story],
      createdAt: new Date().toISOString(),
      viewCount: 1,
      tippingEnabled: false,
      reactions: {
        agree: 0,
        disagree: 0,
        fire: 0,
        skull: 0,
        mindblown: 0,
        clapping: 0,
      },
    }

    // Add story to feed (dedup by creatorId so it doesn't duplicate)
    setStoryGroups((prev) => {
      const existingIdx = prev.findIndex((g) => g.creatorId === authorId)
      if (existingIdx >= 0) {
        // Add to existing group
        const updated = [...prev]
        updated[existingIdx] = {
          ...updated[existingIdx],
          stories: [story, ...updated[existingIdx].stories],
          createdAt: new Date().toISOString(),
        }
        return updated
      }
      return [newGroup, ...prev]
    })

    // Open viewer immediately
    setViewingGroupId(authorId)

    // Re-fetch from Firestore after a short delay to sync with server data
    setTimeout(() => {
      loadStories()
    }, 3000)
  }, [user, loadStories])

  const handleNavigateCreator = useCallback((_creatorId: string) => {
    setViewingGroupId(null)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Story Feed — discovery screen */}
      <StoryFeed
        storyGroups={storyGroups}
        onOpenStory={handleOpenStory}
        onOpenCreator={handleOpenCreator}
      />

      {/* Story Creator */}
      <AnimatePresence>
        {creatorOpen && (
          <StoryCreator
            open={creatorOpen}
            onClose={handleCloseCreator}
            onStoryPublished={handleStoryPublished}
          />
        )}
      </AnimatePresence>

      {/* Story Viewer — full-screen playback */}
      <AnimatePresence>
        {viewingGroupIndex !== null && viewingGroupIndex >= 0 && (
          <StoryViewer
            groups={storyGroups}
            initialGroupIndex={viewingGroupIndex}
            onClose={handleCloseStory}
            onNavigateCreator={handleNavigateCreator}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
