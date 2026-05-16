'use client'

import { useState } from 'react'
import { useAppStore } from '@/stores/app'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  getAdStatusColor,
  formatCurrency,
  formatNumber,
  type AdCampaign,
} from '@/lib/crm'

function loadCampaigns(): AdCampaign[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem('black94_ads')
  if (stored) {
    try { return JSON.parse(stored) } catch { /* fall through */ }
  }
  return []
}

export function AdsManagerView() {
  const navigate = useAppStore((s) => s.navigate)
  const [campaigns, setCampaigns] = useState<AdCampaign[]>(loadCampaigns)

  const allCampaigns = campaigns
  const totalImpressions = allCampaigns.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = allCampaigns.reduce((s, c) => s + c.clicks, 0)
  const totalSpend = allCampaigns.reduce((s, c) => s + c.spend, 0)
  const totalConversions = allCampaigns.reduce((s, c) => s + (c.conversions || 0), 0)
  const overallCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0'

  const toggleStatus = (id: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === id) {
        const next = c.status === 'Active' ? 'Paused' : c.status === 'Paused' ? 'Active' : c.status
        toast.success(`Campaign ${next.toLowerCase()}`)
        return { ...c, status: next as AdCampaign['status'] }
      }
      return c
    }))
  }

  const maxImpressions = 0

  return (
    <div className="px-4 pt-2 pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('business-dashboard')} className="p-2 -ml-2 rounded-full hover:bg-white/[0.06] transition-colors">
          <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h1 className="text-xl font-bold text-[#e7e9ea]">Ad Manager</h1>
        <button
          onClick={() => navigate('create-ad')}
          className="px-3 py-1.5 rounded-full bg-[#FFFFFF] text-black text-[13px] font-bold hover:bg-[#D1D5DB] transition-colors"
        >
          + Create Ad
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Impressions', value: formatNumber(totalImpressions), icon: '👁', gradient: 'from-[#FFFFFF]/10 to-transparent', trend: '+12.5%' },
          { label: 'Total Clicks', value: formatNumber(totalClicks), icon: '👆', gradient: 'from-[#ffd700]/10 to-transparent', sub: `CTR ${overallCTR}%` },
          { label: 'Total Spend', value: formatCurrency(totalSpend), icon: '💰', gradient: 'from-orange-500/10 to-transparent' },
          { label: 'Conversions', value: formatNumber(totalConversions), icon: '🎯', gradient: 'from-[#FFFFFF]/10 to-transparent' },
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-xl bg-gradient-to-br p-4 border border-white/[0.06]', stat.gradient)}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">{stat.icon}</span>
              <span className="text-[12px] text-[#94a3b8] font-medium">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-[#e7e9ea]">{stat.value}</p>
            {(stat.trend || stat.sub) && (
              <p className="text-[12px] text-[#FFFFFF] mt-1">{stat.trend || stat.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Performance Chart */}
      <div className="rounded-xl bg-[#000000] border border-white/[0.06] p-4">
        <h3 className="text-sm font-semibold text-[#e7e9ea] mb-4">Impressions — Last 7 Days</h3>
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            </div>
            <p className="text-[13px] text-[#94a3b8]">No data available</p>
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      <div>
        <h3 className="text-sm font-semibold text-[#e7e9ea] mb-3">Campaigns</h3>
        <div className="space-y-3">
          {allCampaigns.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📢</span>
              </div>
              <p className="text-[15px] text-[#e7e9ea] font-medium">No campaigns yet</p>
              <p className="text-[13px] text-[#94a3b8] mt-1">Create your first ad campaign to get started</p>
            </div>
          ) : (
            allCampaigns.map((campaign) => {
              const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : '0'
              return (
                <div key={campaign.id} className="rounded-xl bg-[#000000] border border-white/[0.06] p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-[15px] font-semibold text-[#e7e9ea]">{campaign.name}</h4>
                      <p className="text-[12px] text-[#94a3b8] mt-0.5 truncate max-w-[200px]">{campaign.headline}</p>
                    </div>
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0', getAdStatusColor(campaign.status))}>
                      {campaign.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div>
                      <p className="text-[11px] text-[#94a3b8]">Impressions</p>
                      <p className="text-[13px] font-semibold text-[#e7e9ea]">{formatNumber(campaign.impressions)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#94a3b8]">Clicks</p>
                      <p className="text-[13px] font-semibold text-[#e7e9ea]">{formatNumber(campaign.clicks)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#94a3b8]">CTR</p>
                      <p className="text-[13px] font-semibold text-[#ffd700]">{ctr}%</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#94a3b8]">Spend</p>
                      <p className="text-[13px] font-semibold text-[#e7e9ea]">{formatCurrency(campaign.spend)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {campaign.status !== 'Ended' && (
                      <button
                        onClick={() => toggleStatus(campaign.id)}
                        className={cn(
                          'px-3 py-1 rounded-full text-[12px] font-semibold transition-colors',
                          campaign.status === 'Active'
                            ? 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25'
                            : 'bg-[#FFFFFF]/15 text-[#FFFFFF] hover:bg-[#FFFFFF]/25'
                        )}
                      >
                        {campaign.status === 'Active' ? 'Pause' : 'Resume'}
                      </button>
                    )}
                    <button
                      disabled
                      className="px-3 py-1 rounded-full text-[12px] font-semibold bg-white/[0.06] text-[#e7e9ea] opacity-50 cursor-not-allowed"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl bg-[#000000] border border-white/[0.06] p-4">
        <h3 className="text-sm font-semibold text-[#e7e9ea] mb-3">Recent Activity</h3>
        <div className="flex items-center justify-center py-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
            <p className="text-[13px] text-[#94a3b8]">No activity yet</p>
          </div>
        </div>
      </div>
    </div>
  )
}
