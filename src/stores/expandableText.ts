import { create } from 'zustand'

/**
 * Lightweight Zustand store for managing per-post "expanded" state.
 * Keeps expanded posts keyed by postId — survives scroll but not page refresh.
 * LRU eviction at 200 entries to prevent memory bloat in very long feeds.
 */

const MAX_ENTRIES = 200

interface ExpandableTextState {
  expanded: Set<string>
  toggle: (id: string) => void
  reset: (id: string) => void
}

export const useExpandableTextStore = create<ExpandableTextState>((set) => ({
  expanded: new Set<string>(),

  toggle: (id) =>
    set((state) => {
      const next = new Set(state.expanded)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        // LRU eviction
        if (next.size > MAX_ENTRIES) {
          const iter = next.values()
          for (let i = 0; i < next.size - MAX_ENTRIES; i++) {
            next.delete(iter.next().value)
          }
        }
      }
      return { expanded: next }
    }),

  reset: (id) =>
    set((state) => {
      const next = new Set(state.expanded)
      next.delete(id)
      return { expanded: next }
    }),
}))
