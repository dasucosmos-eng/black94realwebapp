'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useAppStore, type AppView } from '@/stores/app'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'
import { SidebarItem } from '@/components/SidebarItem'
import {
  House,
  Search,
  Bell,
  MessageCircle,
  Radio,
  LayoutDashboard,
  User,
  Bookmark,
  Ellipsis,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

// ─── Navigation Config ───────────────────────────────────────────────────────

interface NavItem {
  id: string
  label: string
  icon: (props: { className?: string }) => ReactNode
  view: AppView
  badge?: string | number
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: (p) => <House {...p} strokeWidth={2} />, view: 'feed' },
  { id: 'explore', label: 'Explore', icon: (p) => <Search {...p} strokeWidth={2} />, view: 'explore' },
  { id: 'notifications', label: 'Notifications', icon: (p) => <Bell {...p} strokeWidth={2} />, view: 'notifications' },
  { id: 'messages', label: 'Messages', icon: (p) => <MessageCircle {...p} strokeWidth={2} />, view: 'chat' },
  { id: 'stories', label: 'Stories', icon: (p) => <Radio {...p} strokeWidth={2} />, view: 'stories' },
  { id: 'premium', label: 'Dashboard', icon: (p) => <LayoutDashboard {...p} strokeWidth={2} />, view: 'premium-dashboard' },
  { id: 'profile', label: 'Profile', icon: (p) => <User {...p} strokeWidth={2} />, view: 'profile' },
  { id: 'bookmarks', label: 'Bookmarks', icon: (p) => <Bookmark {...p} strokeWidth={2} />, view: 'feed' },
]

// ─── Responsive Hook ─────────────────────────────────────────────────────────

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}

// ─── Sidebar Component ───────────────────────────────────────────────────────

export function Sidebar() {
  const { currentView, navigate, setSidebarOpen, sidebarOpen, user, unreadNotificationCount, composeOpen, setComposeOpen } = useAppStore()
  const isMobile = useIsMobile(768)
  const [expanded, setExpanded] = useState(true)

  const isExpanded = isMobile ? sidebarOpen : expanded
  const showDrawer = isMobile && sidebarOpen

  const handleNavigate = useCallback(
    (view: AppView) => {
      navigate(view)
      if (isMobile) useAppStore.getState().setSidebarOpen(false)
    },
    [navigate, isMobile]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && showDrawer) useAppStore.getState().setSidebarOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showDrawer])

  useEffect(() => {
    document.body.style.overflow = showDrawer ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showDrawer])

  const sidebarContent = (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        'flex h-full flex-col bg-[#000000]',
        'transition-[width] duration-[250ms] ease-in-out',
        !isMobile && (isExpanded ? 'w-[260px]' : 'w-[72px]'),
        isMobile && 'w-[280px]'
      )}
    >
      {/* ── Top: Logo ── */}
      <div className={cn(
        'flex items-center shrink-0 px-4 pt-5 pb-2 h-[68px]',
        !isExpanded && 'justify-center'
      )}>
        {isExpanded ? (
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Black94" width={32} height={32} className="rounded-lg" unoptimized />
            <span className="text-lg font-black text-white tracking-tight select-none">Black94</span>
          </div>
        ) : (
          <Image src="/logo.png" alt="Black94" width={28} height={28} className="rounded-lg" unoptimized />
        )}
      </div>

      {/* ── Middle: Navigation ── */}
      <nav role="menu" className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
        <ul className="flex flex-col gap-0.5" role="menubar">
          {NAV_ITEMS.map((item) => {
            const IconComponent = item.icon
            const isActive = currentView === item.view
            const itemBadge = item.id === 'notifications' && unreadNotificationCount > 0 ? unreadNotificationCount : undefined

            // Profile item: same style as other items via SidebarItem
            return (
              <li key={item.id} role="none">
                <SidebarItem
                  icon={<IconComponent className="h-full w-full" />}
                  label={item.label}
                  active={isActive}
                  badge={itemBadge}
                  collapsed={!isExpanded}
                  onClick={() => handleNavigate(item.view)}
                />
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Bottom: Toggle + User ── */}
      <div className="shrink-0 px-3 py-3 space-y-1">
        {/* Post / More button for collapsed mode */}
        {!isMobile && (
          <button
            type="button"
            aria-label={isExpanded ? 'More options' : 'More'}
            onClick={() => setExpanded(!isExpanded)}
            className={cn(
              'flex items-center gap-3 rounded-full px-3 py-2.5 transition-all duration-150 w-full',
              'text-[#e7e9ea] hover:bg-white/[0.07]',
              'outline-none',
              !isExpanded && 'justify-center'
            )}
          >
            {isExpanded ? (
              <>
                <Ellipsis className="h-[26px] w-[26px] shrink-0" />
                <span className="text-[15px] font-bold select-none">More</span>
              </>
            ) : (
              <PanelLeftClose className="h-[26px] w-[26px] shrink-0" />
            )}
          </button>
        )}

        {/* User profile card */}
        <button
          type="button"
          aria-label="Go to profile"
          onClick={() => handleNavigate('profile')}
          className={cn(
            'group flex w-full items-center gap-3 rounded-full p-2.5 transition-all duration-150',
            'hover:bg-white/[0.07]',
            'outline-none',
            !isExpanded && 'justify-center'
          )}
        >
          <PAvatar
            src={user?.profileImage}
            name={user?.displayName || user?.username}
            size={36}
            verified={user?.isVerified}
            badge={user?.badge}
          />
          {isExpanded && (
            <div className="flex min-w-0 flex-1 flex-col items-start">
              <span className="truncate text-sm font-bold text-white leading-tight inline-flex items-center gap-1.5">
                {user?.displayName || 'User'}
                {(user?.isVerified || !!user?.badge) && <VerifiedBadge size={16} badge={user?.badge} />}
              </span>
              <span className="truncate text-sm text-[#71767b] leading-tight">
                @{user?.username || 'user'}
              </span>
            </div>
          )}
        </button>
      </div>
    </aside>
  )

  // ── Mobile: Drawer overlay ──
  if (isMobile) {
    return (
      <>
        <div
          role="dialog"
          aria-hidden="true"
          className={cn(
            'fixed inset-0 z-40 bg-[#000000]/60 backdrop-blur-sm transition-opacity duration-300',
            showDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
          onClick={() => useAppStore.getState().setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
        <div className={cn('fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out', showDrawer ? 'translate-x-0' : '-translate-x-full')}>
          {sidebarContent}
        </div>
      </>
    )
  }

  // ── Desktop: Fixed sidebar ──
  return <div className="fixed inset-y-0 left-0 z-30">{sidebarContent}</div>
}
