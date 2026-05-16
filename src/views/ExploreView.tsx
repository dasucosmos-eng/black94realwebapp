'use client'

import { useState } from 'react'
import { useAppStore } from '@/stores/app'
import { useAppStore as useAppStore2 } from '@/stores/app'

const CATEGORIES = [
  { id: 'trending', label: 'Trending', icon: '🔥' },
  { id: 'tech', label: 'Technology', icon: '💻' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'news', label: 'News', icon: '📰' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
]

export function ExploreView() {
  const navigate = useAppStore((s) => s.navigate)
  const user = useAppStore2((s) => s.user)
  const [activeCategory, setActiveCategory] = useState('trending')
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (query: string) => {
    if (query.trim()) {
      navigate('search')
    }
  }

  return (
    <div>
      {/* Search bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-3 bg-white/[0.06] rounded-full px-4 py-2.5 border border-white/[0.08] focus-within:border-[#FFFFFF]/50 transition-all">
          <svg className="w-5 h-5 text-[#94a3b8] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
            placeholder="Search Black94"
            className="flex-1 bg-transparent text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-1.5 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? 'bg-[#e7e9ea] text-black'
                : 'bg-white/[0.06] text-[#e7e9ea] hover:bg-white/[0.1]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Trending */}
      <div className="border-t border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-2">
          <h3 className="text-xl font-bold text-[#e7e9ea]">Trending Now</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center px-8">
          <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
            <svg className="w-8 h-8 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M13 17h8m-8 0V9m0 8l-2-2m2 2l2-2M3 3l18 18" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-[15px] font-bold text-[#e7e9ea] mb-1">No trending topics yet</h3>
          <p className="text-[14px] text-[#94a3b8]">Trending topics will appear here as people post.</p>
        </div>
      </div>

      {/* Who to follow — empty state */}
      <div className="px-4 py-4">
        <h3 className="text-lg font-bold text-[#e7e9ea] mb-3">Who to follow</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2m22-6l-10 10M16 3l-8 8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-[14px] text-[#94a3b8]">Suggestions will appear here as more people join.</p>
        </div>
      </div>
    </div>
  )
}
