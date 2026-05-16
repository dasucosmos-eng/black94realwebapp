'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'

interface MobileHeaderProps {
  user: { displayName: string; username: string; profileImage: string } | null
  showBack?: boolean
  onBack?: () => void
  onProfileClick?: () => void
  onSettingsClick?: () => void
  onSignOut?: () => void
  onLogoClick?: () => void
  headerState?: 'visible' | 'hiding' | 'hidden'
  title?: string
  centerContent?: React.ReactNode
}

export function MobileHeader({
  user,
  showBack = false,
  onBack,
  onProfileClick,
  onSettingsClick,
  onSignOut,
  onLogoClick,
  headerState = 'visible',
  title,
  centerContent,
}: MobileHeaderProps) {
  const stateClass =
    headerState === 'visible'
      ? 'header-visible'
      : headerState === 'hiding'
        ? 'header-hiding'
        : 'header-hidden'

  return (
    <header
      className={cn(
        'sticky top-0 z-30 bg-[#000000] border-b border-white/[0.06] safe-area-top',
        stateClass
      )}
    >
      <div className="flex items-center justify-between h-[56px] px-5">
        {/* Left: Hamburger menu */}
        <div className="w-10 flex items-center justify-start">
          {showBack ? (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
              aria-label="Go back"
            >
              <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => useAppStore.getState().setSidebarOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-[22px] h-[22px] text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Center: Custom Content, Title, or Logo */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-center h-[56px] pointer-events-none">
          {centerContent ? (
            <div className="pointer-events-auto">{centerContent}</div>
          ) : title ? (
            <span className="text-[17px] font-bold text-[#e7e9ea]">{title}</span>
          ) : (
            <button onClick={onLogoClick} className="pointer-events-auto focus:outline-none">
              <img src="/logo.png" alt="Black94" className="w-7 h-7 object-contain" />
            </button>
          )}
        </div>

        {/* Right: Settings only */}
        <div className="w-10 flex items-center justify-end">
          <button
            onClick={onSettingsClick}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
            aria-label="Settings"
          >
            <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
