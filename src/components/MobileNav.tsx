'use client'

import { cn } from '@/lib/utils'
import { useAppStore, type AppView } from '@/stores/app'
import {
  House,
  Search,
  Bell,
  MessageCircle,
  Radio,
} from 'lucide-react'

interface MobileNavProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

const NAV_ITEMS: { view: AppView; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    view: 'feed',
    label: 'Home',
    icon: (active) => (
      <House
        className={cn('w-[24px] h-[24px]', active ? 'text-[#ffffff]' : 'text-[#ffffff]')}
        strokeWidth={active ? 2.4 : 2.2}
        fill={active ? 'currentColor' : 'none'}
      />
    ),
  },
  {
    view: 'search',
    label: 'Search',
    icon: (active) => (
      <Search
        className={cn('w-[24px] h-[24px]', active ? 'text-[#ffffff]' : 'text-[#ffffff]')}
        strokeWidth={active ? 2.4 : 2.2}
      />
    ),
  },
  {
    view: 'chat',
    label: 'Chat',
    icon: (active) => (
      <MessageCircle
        className={cn('w-[24px] h-[24px]', active ? 'text-[#ffffff]' : 'text-[#ffffff]')}
        strokeWidth={active ? 2.4 : 2.2}
      />
    ),
  },
  {
    view: 'notifications',
    label: 'Alerts',
    icon: (active) => (
      <Bell
        className={cn('w-[24px] h-[24px]', active ? 'text-[#ffffff]' : 'text-[#ffffff]')}
        strokeWidth={active ? 2.4 : 2.2}
      />
    ),
  },
  {
    view: 'stories',
    label: 'Stories',
    icon: (active) => (
      <Radio
        className={cn('w-[24px] h-[24px]', active ? 'text-[#ffffff]' : 'text-[#ffffff]')}
        strokeWidth={active ? 2.4 : 2.2}
      />
    ),
  },
]

export function MobileNav({ currentView, onNavigate }: MobileNavProps) {
  const unreadNotificationCount = useAppStore((s) => s.unreadNotificationCount)

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#000000] border-t border-white/[0.06] safe-area-bottom shrink-0">
      <div className="flex items-center justify-around h-[50px]">
        {NAV_ITEMS.map(({ view, label, icon }) => {
          const isActive = currentView === view
          const showBadge = view === 'notifications' && unreadNotificationCount > 0
          return (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className="flex flex-col items-center justify-center w-16 h-full relative transition-colors duration-150"
              aria-label={label}
            >
              {icon(isActive)}
              {showBadge && (
                <span className="absolute top-[4px] right-[10px] min-w-[16px] h-[16px] rounded-full bg-[#FFFFFF] text-black text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
