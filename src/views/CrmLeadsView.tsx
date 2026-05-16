'use client'

import { useState } from 'react'
import { useAppStore } from '@/stores/app'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getLeadScoreBg, getLeadSourceColor } from '@/lib/crm'
import type { Lead } from '@/lib/crm'

const FILTER_TABS = ['All', 'Hot', 'Warm', 'Cold', 'Converted'] as const
type FilterTab = typeof FILTER_TABS[number]

function classifyLead(lead: Lead): FilterTab {
  if (lead.status === 'Converted') return 'Converted'
  if (lead.aiScore > 80) return 'Hot'
  if (lead.aiScore >= 50) return 'Warm'
  return 'Cold'
}

const LEAD_STATUS_COLORS: Record<string, string> = {
  New: 'bg-blue-500/15 text-blue-400',
  Contacted: 'bg-yellow-500/15 text-yellow-400',
  Qualified: 'bg-[#FFFFFF]/15 text-[#FFFFFF]',
  Converted: 'bg-[#FFFFFF]/15 text-[#FFFFFF]',
  Lost: 'bg-red-500/15 text-red-400',
}

export function CrmLeadsView() {
  const navigate = useAppStore((s) => s.navigate)
  const [activeTab, setActiveTab] = useState<FilterTab>('All')

  const leads: Lead[] = []
  const filteredLeads = activeTab === 'All'
    ? leads
    : leads.filter(lead => classifyLead(lead) === activeTab)

  return (
    <div className="px-4 pt-2 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('business-dashboard')} className="p-2 -ml-2 rounded-full hover:bg-white/[0.06] transition-colors">
            <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-xl font-bold text-[#e7e9ea]">Leads</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-white/[0.06] transition-colors">
            <svg className="w-5 h-5 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
          </button>
          <button
            disabled
            className="px-3 py-1.5 rounded-full bg-[#FFFFFF] text-black text-[13px] font-bold opacity-50 cursor-not-allowed"
          >
            + Add Lead
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors',
              activeTab === tab
                ? 'bg-[#FFFFFF] text-black'
                : 'bg-white/[0.06] text-[#e7e9ea] hover:bg-white/[0.1]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Leads Count */}
      <p className="text-[12px] text-[#94a3b8]">{filteredLeads.length} leads found</p>

      {/* Leads List */}
      <div className="space-y-3">
        {filteredLeads.map((lead) => (
          <div key={lead.id} className="rounded-xl bg-[#000000] border border-white/[0.06] p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1a2a1a] to-[#110f1a] flex items-center justify-center text-[14px] text-[#FFFFFF] font-bold shrink-0">
                {lead.name[0]}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-[15px] font-semibold text-[#e7e9ea] truncate">{lead.name}</h4>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', getLeadScoreBg(lead.aiScore))}>
                    {lead.aiScore}
                  </span>
                </div>
                <p className="text-[12px] text-[#94a3b8] mt-0.5 truncate">{lead.email}</p>
                <p className="text-[12px] text-[#64748b]">{lead.phone}</p>

                {/* Badges Row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', getLeadSourceColor(lead.source))}>
                    {lead.source}
                  </span>
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', LEAD_STATUS_COLORS[lead.status] || 'bg-white/10 text-[#94a3b8]')}>
                    {lead.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
              <span className="text-[11px] text-[#64748b]">Last activity: {lead.updatedAt}</span>
              <button
                disabled
                className="px-3 py-1 rounded-full text-[12px] font-semibold bg-white/[0.06] text-[#e7e9ea] opacity-50 cursor-not-allowed"
              >
                View
              </button>
            </div>
          </div>
        ))}

        {filteredLeads.length === 0 && (
          <div className="text-center py-12">
            <span className="text-3xl">📭</span>
            <p className="text-[14px] text-[#94a3b8] mt-2">No leads in this category</p>
          </div>
        )}
      </div>
    </div>
  )
}
