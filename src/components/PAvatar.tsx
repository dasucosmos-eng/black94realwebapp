'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface PAvatarProps {
  src?: string | null
  name?: string
  size?: number
  className?: string
  verified?: boolean
  badge?: string // 'free' | 'pro' | 'gold' | '' | 'blue'
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name.slice(0, 2)).toUpperCase()
}

function resolveBadgeColor(badge?: string): string {
  if (badge === 'gold') return '#ffd700'
  if (badge === 'pro' || badge === 'blue') return '#3b82f6'
  return '#FFFFFF' // default rose gold for generic verified
}

/* ── Verified badge SVG (reusable, for inline use next to names) ─────── */

export function VerifiedBadge({ size = 14, badge }: { size?: number; badge?: string }) {
  const color = resolveBadgeColor(badge)
  return (
    <svg className="shrink-0" width={size} height={size} viewBox="0 0 22 22" fill="none">
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.853-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.54.354 1.167.551 1.813.568.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.225 1.261.275 1.894.144.634-.13 1.219-.435 1.69-.882.445-.47.749-1.055.878-1.691.13-.634.084-1.292-.139-1.899.586-.272 1.084-.701 1.438-1.24.354-.542.551-1.172.57-1.82z" fill={color}/>
      <path d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="#000"/>
    </svg>
  )
}

export function PAvatar({ src, name, size = 40, className }: PAvatarProps) {
  const initials = getInitials(name)

  return (
    <div className="relative inline-flex shrink-0">
      {src ? (
        <div
          className={cn('rounded-full overflow-hidden bg-[#000000]', className)}
          style={{ width: size, height: size }}
        >
          <Image
            src={src}
            alt={name ?? 'User'}
            width={size}
            height={size}
            className="object-cover w-full h-full"
            unoptimized
          />
        </div>
      ) : (
        <div
          className={cn(
            'rounded-full bg-gradient-to-br from-[#FFFFFF] to-[#9CA3AF] flex items-center justify-center text-black font-bold shrink-0',
            className
          )}
          style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
          {initials}
        </div>
      )}
    </div>
  )
}
