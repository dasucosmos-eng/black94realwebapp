'use client'

import { useState } from 'react'
import { useAppStore } from '@/stores/app'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getStageColor, formatCurrency } from '@/lib/crm'
import type { Deal } from '@/lib/crm'

const STAGES = ['New', 'Contacted', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const

function daysSince(dateStr: string): number {
  const created = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
}

export function CrmDealsView() {
  const navigate = useAppStore((s) => s.navigate)
  const [deals, setDeals] = useState<Deal[]>([])

  const moveDeal = (dealId: string, newStage: string) => {
    setDeals(prev => prev.map(d => {
      if (d.id === dealId) {
        toast.success(`"${d.name}" moved to ${newStage}`)
        return { ...d, stage: newStage as Deal['stage'], updatedAt: new Date().toISOString().split('T')[0] }
      }
      return d
    }))
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#000000]/90 backdrop-blur-md border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('business-dashboard')} className="p-2 -ml-2 rounded-full hover:bg-white/[0.06] transition-colors">
              <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <h1 className="text-xl font-bold text-[#e7e9ea]">Deals</h1>
          </div>
          <button
            onClick={() => {
              const name = prompt('Deal name:') || ''
              if (!name.trim()) return
              const contact = prompt('Contact name:') || 'Unknown'
              const value = parseInt(prompt('Deal value (₹):') || '0') || 0
              setDeals(prev => [...prev, {
                id: `D${Date.now()}`,
                name: name.trim(),
                value,
                contactName: contact.trim(),
                stage: 'New' as Deal['stage'],
                createdAt: new Date().toISOString().split('T')[0],
                updatedAt: new Date().toISOString().split('T')[0],
              }])
              toast.success(`Deal "${name.trim()}" created`)
            }}
            className="px-3 py-1.5 rounded-full bg-[#FFFFFF] text-black text-[13px] font-bold hover:bg-[#D1D5DB] transition-colors"
          >
            + New Deal
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pt-4" style={{ minHeight: 'calc(100vh - 120px)' }}>
        {STAGES.map((stage) => {
          const stageDeals = deals.filter(d => d.stage === stage)
          const stageValue = stageDeals.reduce((s, d) => s + d.value, 0)
          return (
            <div key={stage} className="shrink-0 w-[260px]">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={cn('w-2.5 h-2.5 rounded-full', stage === 'New' ? 'bg-blue-400' : stage === 'Contacted' ? 'bg-yellow-400' : stage === 'Proposal' ? 'bg-[#FFFFFF]' : stage === 'Negotiation' ? 'bg-orange-400' : stage === 'Won' ? 'bg-[#FFFFFF]' : 'bg-red-400')} />
                  <h3 className="text-[13px] font-semibold text-[#e7e9ea]">{stage}</h3>
                  <span className="text-[11px] text-[#64748b] bg-white/[0.06] px-1.5 py-0.5 rounded-full">{stageDeals.length}</span>
                </div>
                <span className="text-[11px] text-[#FFFFFF] font-semibold">{formatCurrency(stageValue)}</span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {stageDeals.map((deal) => (
                  <div key={deal.id} className="rounded-xl bg-[#000000] border border-white/[0.06] p-3">
                    <h4 className="text-[14px] font-semibold text-[#e7e9ea] leading-snug">{deal.name}</h4>
                    <p className="text-[16px] font-bold text-[#FFFFFF] mt-1">{formatCurrency(deal.value)}</p>
                    <p className="text-[12px] text-[#94a3b8] mt-1.5">{deal.contactName}</p>
                    <p className="text-[11px] text-[#64748b] mt-1">{daysSince(deal.createdAt)}d in stage</p>

                    {/* Move Buttons */}
                    <div className="flex gap-1 mt-2.5 pt-2.5 border-t border-white/[0.04] overflow-x-auto no-scrollbar">
                      {STAGES.filter(s => s !== stage).map(s => (
                        <button
                          key={s}
                          onClick={() => moveDeal(deal.id, s)}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/[0.06] text-[#e7e9ea] hover:bg-white/[0.1] whitespace-nowrap transition-colors"
                        >
                          → {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {stageDeals.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-white/[0.06] p-6 text-center">
                    <p className="text-[12px] text-[#64748b]">No deals</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
