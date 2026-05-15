'use client'

import { useState } from 'react'
import { useAppStore } from '@/stores/app'
import { cn } from '@/lib/utils'
import {
  formatCurrency,
} from '@/lib/crm'

const DATE_RANGES = ['7 days', '30 days', '90 days', 'This Year'] as const

const AI_RECOMMENDATIONS: string[] = []

export function CrmAnalyticsView() {
  const navigate = useAppStore((s) => s.navigate)
  const [dateRange, setDateRange] = useState<string>('30 days')

  // Empty state — no data yet
  const filteredRevenueData: never[] = []
  const filteredAcquisitionData: never[] = []
  const maxRevenue = 0
  const maxCustomers = 0
  const maxProductRevenue = 0
  const totalSourceCount = 0
  const gradientSegments = ''

  return (
    <div className="px-4 pt-2 pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('business-dashboard')} className="p-2 -ml-2 rounded-full hover:bg-white/[0.06] transition-colors">
            <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-xl font-bold text-[#e7e9ea]">Analytics</h1>
        </div>
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="bg-[#000000] border border-white/[0.08] rounded-full px-3 py-1.5 text-[12px] text-[#e7e9ea] outline-none appearance-none cursor-pointer"
        >
          {DATE_RANGES.map(r => <option key={r} value={r} className="bg-[#000000] text-[#e7e9ea]">{r}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Revenue', value: '—', gradient: 'from-[#FFFFFF]/10 to-transparent', change: '' },
          { label: 'Total Leads', value: '0', gradient: 'from-blue-500/10 to-transparent', change: '' },
          { label: 'Conversion Rate', value: '0%', gradient: 'from-[#ffd700]/10 to-transparent', change: '' },
          { label: 'Avg Deal Size', value: '—', gradient: 'from-[#FFFFFF]/10 to-transparent', change: '' },
          { label: 'Customer LTV', value: '—', gradient: 'from-orange-500/10 to-transparent', change: '' },
          { label: 'Active Customers', value: '0', gradient: 'from-cyan-500/10 to-transparent', change: '' },
        ].map((kpi) => (
          <div key={kpi.label} className={cn('rounded-xl bg-gradient-to-br p-4 border border-white/[0.06]', kpi.gradient)}>
            <p className="text-[12px] text-[#94a3b8] font-medium">{kpi.label}</p>
            <p className="text-xl font-bold text-[#e7e9ea] mt-1">{kpi.value}</p>
            {kpi.change && <p className="text-[11px] text-[#FFFFFF] mt-0.5">{kpi.change} ↑</p>}
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="rounded-xl bg-[#000000] border border-white/[0.06] p-4">
        <h3 className="text-sm font-semibold text-[#e7e9ea] mb-4">Monthly Revenue</h3>
        <div className="flex items-center justify-center h-36">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
            </div>
            <p className="text-[13px] text-[#94a3b8]">No data available</p>
          </div>
        </div>
      </div>

      {/* Lead Sources */}
      <div className="rounded-xl bg-[#000000] border border-white/[0.06] p-4">
        <h3 className="text-sm font-semibold text-[#e7e9ea] mb-4">Lead Sources</h3>
        <div className="flex items-center justify-center py-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0110 10" /></svg>
            </div>
            <p className="text-[13px] text-[#94a3b8]">No data available</p>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="rounded-xl bg-[#000000] border border-white/[0.06] p-4">
        <h3 className="text-sm font-semibold text-[#e7e9ea] mb-4">Top Products / Services</h3>
        <div className="flex items-center justify-center py-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-2">
              <span className="text-lg">📦</span>
            </div>
            <p className="text-[13px] text-[#94a3b8]">No data available</p>
          </div>
        </div>
      </div>

      {/* Customer Acquisition Trend */}
      <div className="rounded-xl bg-[#000000] border border-white/[0.06] p-4">
        <h3 className="text-sm font-semibold text-[#e7e9ea] mb-4">Customer Acquisition</h3>
        <div className="flex items-center justify-center h-28">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
            </div>
            <p className="text-[13px] text-[#94a3b8]">No data available</p>
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="rounded-xl bg-gradient-to-br from-[#1a1a2a] to-[#110f1a] border border-[#FFFFFF]/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🧠</span>
          <h3 className="text-sm font-semibold text-[#F3F4F6]">AI Recommendations</h3>
        </div>
        <div className="space-y-3">
          {AI_RECOMMENDATIONS.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-[13px] text-[#94a3b8]">No recommendations yet — connect your data to get started</p>
            </div>
          ) : (
            AI_RECOMMENDATIONS.map((rec, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF] mt-1.5 shrink-0" />
                <p className="text-[13px] text-[#c0c0c0] leading-relaxed">{rec}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
