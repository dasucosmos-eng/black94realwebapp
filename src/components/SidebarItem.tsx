'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

interface SidebarItemProps {
  icon: ReactNode
  label: string
  active: boolean
  badge?: string | number
  collapsed: boolean
  onClick: () => void
}

export function SidebarItem({
  icon,
  label,
  active,
  badge,
  collapsed,
  onClick,
}: SidebarItemProps) {
  const showBadge = badge !== undefined && badge !== null && badge !== 0

  const itemContent = (
    <button
      type="button"
      role="menuitem"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 rounded-full px-3 py-2.5 text-[15px] transition-all duration-150 ease-in-out outline-none',
        'focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#000000]',
        active
          ? 'text-white'
          : 'text-[#a0a3a8] hover:text-white hover:bg-white/[0.05]',
        collapsed ? 'justify-center' : 'w-full'
      )}
    >
      {/* Icon */}
      <span
        className={cn(
          'shrink-0 transition-colors duration-150',
          active ? 'text-white' : 'text-[#a0a3a8] group-hover:text-white',
          'h-[26px] w-[26px]'
        )}
      >
        {icon}
      </span>

      {/* Label */}
      {!collapsed && (
        <span className={cn(
          'truncate select-none',
          active ? 'text-white font-black' : 'font-black text-[#a0a3a8]'
        )}>{label}</span>
      )}

      {/* Badge */}
      {showBadge && !collapsed && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-black">
          {typeof badge === 'number' && badge > 99 ? '99+' : badge}
        </span>
      )}

      {/* Badge dot for collapsed */}
      {showBadge && collapsed && (
        <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-white ring-2 ring-[#000000]" />
      )}
    </button>
  )

  // Collapsed mode: wrap with tooltip
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{itemContent}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={12}
          className="rounded-lg border border-white/10 bg-[#1a1823] px-3 py-1.5 text-sm font-bold text-white shadow-lg"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return itemContent
}
