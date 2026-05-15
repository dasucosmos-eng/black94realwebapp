'use client'

import { useAppStore } from '@/stores/app'

export function PremiumDashboardView() {
  const user = useAppStore((s) => s.user)
  const navigate = useAppStore((s) => s.navigate)

  const isBusiness = user?.role === 'business' || user?.accountType === 'business'

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('settings')}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-[#e7e9ea]">Dashboard</h1>
        </div>

        {/* Profile Card */}
        <div className="rounded-2xl bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0a] border border-white/[0.08] p-5 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden">
              {user?.profileImage ? (
                <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-6 h-6 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-[16px] font-bold text-white">{user?.displayName || user?.username || 'User'}</p>
              <p className="text-[13px] text-white/40">@{user?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20">
              {isBusiness ? 'Business' : 'Personal'}
            </span>
          </div>
        </div>

        {/* Quick Links */}
        <div className="rounded-2xl bg-black border border-white/[0.08] p-4 mb-4">
          <h3 className="text-[15px] font-semibold text-white mb-3">Quick Links</h3>
          <div className="space-y-1">
            {[
              { label: 'Business Dashboard', view: 'business-dashboard', show: isBusiness },
              { label: 'Store Dashboard', view: 'store-dashboard', show: isBusiness },
              { label: 'Affiliate Badges', view: 'affiliates', show: isBusiness },
              { label: 'Ad Manager', view: 'ads-manager', show: isBusiness },
              { label: 'CRM Leads', view: 'crm-leads', show: isBusiness },
              { label: 'Privacy Settings', view: 'settings', show: true },
            ].filter(item => item.show).map((item) => (
              <button
                key={item.view}
                onClick={() => navigate(item.view as any)}
                className="w-full flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-white/[0.04] transition-colors"
              >
                <span className="text-[14px] text-white/80">{item.label}</span>
                <svg className="w-4 h-4 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="rounded-2xl bg-[#10b981]/5 border border-[#10b981]/20 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4L12 14.01l-3-3" />
            </svg>
            <div>
              <p className="text-[14px] font-semibold text-[#10b981] mb-1">All features unlocked</p>
              <p className="text-[13px] text-white/40">
                Every feature on Black94 is free. Switch to a business account anytime to unlock business tools, store, CRM, and more.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
