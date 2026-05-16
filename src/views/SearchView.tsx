'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/app'
import { searchUsers, searchPosts } from '@/lib/db'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'
import type { Black94User } from '@/lib/db'

export function SearchView() {
  const navigate = useAppStore((s) => s.navigate)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<Black94User[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [tab, setTab] = useState<'people' | 'posts'>('people')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      // Always search users first
      const u = await searchUsers(searchQuery.trim(), 10)
      setUsers(u)
    } catch (err) {
      console.error('User search failed:', err)
      setUsers([])
    }

    // Search posts separately so it doesn't block user results
    try {
      const p = await searchPosts(searchQuery.trim(), 10)
      setPosts(p)
    } catch (err) {
      console.error('Post search failed (missing composite index):', err)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  // Debounce auto-search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSearched(false)
      setUsers([])
      setPosts([])
      return
    }
    debounceRef.current = setTimeout(() => {
      handleSearch(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  return (
    <div className="px-4 pt-2">
      {/* Search bar */}
      <div className="sticky top-0 z-10 bg-[#000000] pt-2 pb-3 -mx-4 px-4">
        <div className="flex items-center gap-3 bg-white/[0.06] rounded-full px-4 py-2.5 border border-white/[0.08] focus-within:border-[#FFFFFF]/50 focus-within:bg-white/[0.08] transition-all">
          <svg className="w-5 h-5 text-[#94a3b8] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none"
          />
          <button
            onClick={() => handleSearch(query)}
            disabled={loading || !query.trim()}
            className="text-[#FFFFFF] hover:text-[#c4e899] transition-colors disabled:text-[#64748b] disabled:pointer-events-none shrink-0"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search results or trending */}
      {searched ? (
        <div>
          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] mb-4">
            {(['people', 'posts'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-[15px] font-medium relative capitalize transition-colors ${
                  tab === t ? 'text-[#e7e9ea] font-bold' : 'text-[#94a3b8]'
                }`}
              >
                {t}
                {tab === t && (
                  <div className="absolute bottom-0 inset-x-6 h-1 bg-[#FFFFFF] rounded-full" />
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-8 text-center text-[#94a3b8]">Searching...</div>
          ) : tab === 'people' ? (
            <div>
              {users.length === 0 ? (
                <p className="text-[15px] text-[#94a3b8] text-center py-8">No users found</p>
              ) : (
                users.map((u) => (
                  <button
                    key={u.uid}
                    onClick={() => navigate('user-profile', { userId: u.uid })}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors rounded-xl"
                  >
                    <PAvatar src={u.profileImage} name={u.displayName} size={44} verified={u.isVerified} badge={u.badge} />
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-[15px] text-[#e7e9ea] truncate">{u.displayName}</span>
                        {(u.isVerified || !!u.badge) && <VerifiedBadge size={16} badge={u.badge} />}
                      </div>
                      <span className="text-[14px] text-[#94a3b8] truncate">@{u.username}</span>
                      {u.bio && <p className="text-[13px] text-[#94a3b8] truncate mt-0.5">{u.bio}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div>
              {posts.length === 0 ? (
                <p className="text-[15px] text-[#94a3b8] text-center py-8">No posts found</p>
              ) : (
                posts.map((p) => (
                  <div key={p.id} className="px-4 py-3 border-b border-white/[0.06]">
                    <p className="text-[15px] text-[#e7e9ea] leading-relaxed">{p.caption}</p>
                    <p className="text-[13px] text-[#94a3b8] mt-1">by @{p.authorUsername}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        /* No trending yet */
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
            <svg className="w-8 h-8 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="text-[15px] font-bold text-[#e7e9ea] mb-1">Search for people and posts</h3>
          <p className="text-[14px] text-[#94a3b8]">Find users, posts, and topics across Black94.</p>
        </div>
      )}
    </div>
  )
}
