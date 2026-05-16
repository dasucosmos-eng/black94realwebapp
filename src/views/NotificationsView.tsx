'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/app'
import { fetchNotifications, markNotificationRead } from '@/lib/db'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'
import type { Black94Notification } from '@/lib/db'

function notifIcon(type: string) {
  switch (type) {
    case 'like':
      return <svg className="w-[18px] h-[18px] text-[#f43f5e]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
    case 'follow':
      return <svg className="w-[18px] h-[18px] text-[#FFFFFF]" viewBox="0 0 24 24" fill="currentColor"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
    case 'comment':
      return <svg className="w-[18px] h-[18px] text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
    case 'share':
      return <svg className="w-[18px] h-[18px] text-[#10b981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 11V9a4 4 0 014-4h14" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 23l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 13v2a4 4 0 01-4 4H3" strokeLinecap="round" strokeLinejoin="round"/></svg>
    default:
      return <svg className="w-[18px] h-[18px] text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round"/></svg>
  }
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function NotificationsView() {
  const user = useAppStore((s) => s.user)
  const [notifications, setNotifications] = useState<Black94Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchNotifications(user.id)
      .then(setNotifications)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const handleMarkRead = async (notifId: string) => {
    try {
      await markNotificationRead(notifId)
      setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)))
    } catch (err) {
      console.error('Mark read failed:', err)
    }
  }

  return (
    <div>
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-xl font-bold text-[#e7e9ea]">Notifications</h2>
      </div>

      {loading ? (
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
                <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[#e7e9ea] mb-1">Nothing to see here — yet</h3>
          <p className="text-[15px] text-[#94a3b8]">Likes, shares, and follows will show up here.</p>
        </div>
      ) : (
        <div>
          {notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => !notif.read && handleMarkRead(notif.id)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${
                !notif.read ? 'bg-[#FFFFFF]/[0.03]' : ''
              }`}
            >
              <div className="relative shrink-0 mt-0.5">
                <PAvatar src={notif.actorProfileImage} name={notif.actorName} size={36} verified={(notif as any).actorIsVerified} badge={(notif as any).actorBadge} />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#000000] flex items-center justify-center">
                  {notifIcon(notif.type)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-[#e7e9ea] leading-relaxed">
                  <span className="font-bold inline-flex items-center gap-1">{notif.actorName}{((notif as any).actorIsVerified || !!(notif as any).actorBadge) && <VerifiedBadge size={13} badge={(notif as any).actorBadge} />}</span>{' '}
                  {notif.message || notif.type}
                  {!notif.read && <span className="inline-block w-2 h-2 rounded-full bg-[#FFFFFF] ml-1" />}
                </p>
                <p className="text-[13px] text-[#94a3b8] mt-0.5">{timeAgo(notif.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
