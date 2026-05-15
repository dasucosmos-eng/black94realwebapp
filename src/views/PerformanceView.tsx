'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { toast } from 'sonner'
import {
  calculateOverallScore,
  formatNumber,
  formatCurrency,
  type CampaignPerformance,
  type ChannelPerformance,
  type ABTest,
  type AISuggestion,
} from '@/lib/business'

// ── Circular Score Component (CSS-only) ──────────────────────
function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const offset = circumference - progress

  const color =
    score >= 70 ? '#FFFFFF' : score >= 40 ? '#ffd700' : '#ef4444'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: `drop-shadow(0 0 8px ${color}40)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[32px] font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[11px] text-[#94a3b8] uppercase tracking-wider">Score</span>
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ status }: { status: CampaignPerformance['status'] }) {
  const config = {
    active: { label: 'Active', cls: 'bg-[#FFFFFF]/10 text-[#FFFFFF] border-[#FFFFFF]/20' },
    paused: { label: 'Paused', cls: 'bg-[#ffd700]/10 text-[#ffd700] border-[#ffd700]/20' },
    completed: { label: 'Completed', cls: 'bg-white/[0.06] text-[#94a3b8] border-white/[0.08]' },
  }
  const { label, cls } = config[status]
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border', cls)}>
      {label}
    </span>
  )
}

// ── Campaign Card ─────────────────────────────────────────────
function CampaignCard({ campaign }: { campaign: CampaignPerformance }) {
  const utilization = Math.round((campaign.budgetUsed / campaign.budget) * 100)
  return (
    <div className="rounded-2xl bg-[#000000] border border-white/[0.08] p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#e7e9ea] truncate">{campaign.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={campaign.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <MetricRow label="Impressions" value={formatNumber(campaign.impressions)} />
        <MetricRow label="Clicks" value={formatNumber(campaign.clicks)} />
        <MetricRow label="CTR" value={`${campaign.ctr}%`} highlight />
        <MetricRow label="Conversions" value={formatNumber(campaign.conversions)} />
        <MetricRow label="ROI" value={`${campaign.roi}%`} highlight />
      </div>

      {/* Budget Utilization */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#94a3b8]">Budget Used</span>
          <span className="text-[12px] text-[#e7e9ea] font-medium">
            {formatCurrency(campaign.budgetUsed)} / {formatCurrency(campaign.budget)}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              utilization >= 90
                ? 'bg-gradient-to-r from-[#ffd700] to-[#f59e0b]'
                : 'bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB]'
            )}
            style={{ width: `${utilization}%` }}
          />
        </div>
        <p className="text-[11px] text-[#64748b] text-right">{utilization}% utilized</p>
      </div>
    </div>
  )
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-[#64748b]">{label}</p>
      <p
        className={cn(
          'text-[14px] font-medium',
          highlight ? 'text-[#FFFFFF]' : 'text-[#e7e9ea]'
        )}
      >
        {value}
      </p>
    </div>
  )
}

// ── Channel Comparison Bar ────────────────────────────────────
function ChannelBar({ channel, maxImpressions }: { channel: ChannelPerformance; maxImpressions: number }) {
  const impPct = Math.round((channel.impressions / maxImpressions) * 100)
  const clickPct = Math.round((channel.clicks / maxImpressions) * 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium text-[#e7e9ea]">{channel.channel}</p>
        <p className="text-[12px] text-[#FFFFFF] font-medium">{channel.ctr}% CTR</p>
      </div>
      {/* Impressions bar */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[#64748b] w-14 shrink-0">Imp.</span>
        <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FFFFFF]/70 to-[#FFFFFF] transition-all duration-700"
            style={{ width: `${impPct}%` }}
          />
        </div>
        <span className="text-[11px] text-[#94a3b8] w-14 text-right">
          {formatNumber(channel.impressions)}
        </span>
      </div>
      {/* Clicks bar */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[#64748b] w-14 shrink-0">Clicks</span>
        <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ffd700]/70 to-[#ffd700] transition-all duration-700"
            style={{ width: `${clickPct}%` }}
          />
        </div>
        <span className="text-[11px] text-[#94a3b8] w-14 text-right">
          {formatNumber(channel.clicks)}
        </span>
      </div>
    </div>
  )
}

// ── A/B Test Card ─────────────────────────────────────────────
function ABTestCard({ test }: { test: ABTest }) {
  const ctrA = test.variantA.clicks > 0 ? ((test.variantA.conversions / test.variantA.clicks) * 100) : 0
  const ctrB = test.variantB.clicks > 0 ? ((test.variantB.conversions / test.variantB.clicks) * 100) : 0
  const clickRateA = test.variantA.impressions > 0 ? ((test.variantA.clicks / test.variantA.impressions) * 100) : 0
  const clickRateB = test.variantB.impressions > 0 ? ((test.variantB.clicks / test.variantB.impressions) * 100) : 0

  return (
    <div className="rounded-2xl bg-[#000000] border border-white/[0.08] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold text-[#e7e9ea]">{test.name}</p>
        {test.winner && (
          <span className="text-[12px] font-medium text-[#FFFFFF]">
            Variant {test.winner} winning
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Variant A */}
        <div
          className={cn(
            'rounded-xl border p-3 space-y-2 transition-colors',
            test.winner === 'A'
              ? 'bg-[#FFFFFF]/5 border-[#FFFFFF]/30'
              : 'bg-white/[0.02] border-white/[0.06]'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#e7e9ea]">Variant A</span>
            {test.winner === 'A' && (
              <svg className="w-4 h-4 text-[#FFFFFF]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-[#64748b]">Impressions</p>
            <p className="text-[13px] text-[#e7e9ea]">{formatNumber(test.variantA.impressions)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-[#64748b]">Clicks</p>
            <p className="text-[13px] text-[#e7e9ea]">{formatNumber(test.variantA.clicks)} <span className="text-[#64748b]">({clickRateA.toFixed(1)}%)</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-[#64748b]">Conversions</p>
            <p className="text-[13px] text-[#FFFFFF] font-medium">{formatNumber(test.variantA.conversions)} <span className="text-[#64748b] font-normal">({ctrA.toFixed(1)}%)</span></p>
          </div>
        </div>

        {/* Variant B */}
        <div
          className={cn(
            'rounded-xl border p-3 space-y-2 transition-colors',
            test.winner === 'B'
              ? 'bg-[#FFFFFF]/5 border-[#FFFFFF]/30'
              : 'bg-white/[0.02] border-white/[0.06]'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#e7e9ea]">Variant B</span>
            {test.winner === 'B' && (
              <svg className="w-4 h-4 text-[#FFFFFF]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-[#64748b]">Impressions</p>
            <p className="text-[13px] text-[#e7e9ea]">{formatNumber(test.variantB.impressions)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-[#64748b]">Clicks</p>
            <p className="text-[13px] text-[#e7e9ea]">{formatNumber(test.variantB.clicks)} <span className="text-[#64748b]">({clickRateB.toFixed(1)}%)</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-[#64748b]">Conversions</p>
            <p className="text-[13px] text-[#FFFFFF] font-medium">{formatNumber(test.variantB.conversions)} <span className="text-[#64748b] font-normal">({ctrB.toFixed(1)}%)</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AI Suggestion Item ────────────────────────────────────────
function SuggestionItem({ suggestion, onApply }: { suggestion: AISuggestion; onApply: () => void }) {
  const impactConfig = {
    high: { label: 'High Impact', cls: 'bg-[#FFFFFF]/10 text-[#FFFFFF]' },
    medium: { label: 'Medium', cls: 'bg-[#ffd700]/10 text-[#ffd700]' },
    low: { label: 'Low', cls: 'bg-white/[0.06] text-[#94a3b8]' },
  }
  const { label, cls } = impactConfig[suggestion.impact]

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <div className="w-8 h-8 rounded-lg bg-[#FFFFFF]/10 flex items-center justify-center shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 017 7c0 3-2 5-4 6.5V18H9v-2.5C7 14 5 12 5 9a7 7 0 017-7z" />
          <path d="M9 18h6M10 22h4" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[12px] text-[#64748b]">{suggestion.category}</span>
          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', cls)}>
            {label}
          </span>
        </div>
        <p className="text-[13px] text-[#e7e9ea] leading-relaxed">{suggestion.text}</p>
        <button
          onClick={onApply}
          className="mt-2 px-3 py-1 rounded-lg bg-[#FFFFFF]/10 text-[#FFFFFF] text-[12px] font-semibold hover:bg-[#FFFFFF]/20 transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

// ── Main Performance View ─────────────────────────────────────
export function PerformanceView() {
  const navigate = useAppStore((s) => s.navigate)
  const [dateRange] = useState('Last 30 days')

  const overallScore = useMemo(
    () => calculateOverallScore([]),
    []
  )

  const maxChannelImpressions = 0

  const handleApplySuggestion = (suggestion: AISuggestion) => {
    toast.success(`Applied: "${suggestion.text.slice(0, 40)}..."`)
  }

  return (
    <div className="px-4 pt-2 pb-24 space-y-5">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('business-dashboard')}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.06] transition-colors"
        >
          <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-[#e7e9ea] flex-1">Performance</h1>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
          <svg className="w-3.5 h-3.5 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-[12px] text-[#94a3b8] font-medium">{dateRange}</span>
        </div>
      </div>

      {/* ── Overall Score ───────────────────────────────── */}
      <div className="rounded-2xl bg-[#000000] border border-white/[0.08] p-5 flex flex-col items-center">
        <p className="text-[13px] text-[#94a3b8] font-medium uppercase tracking-wider mb-4">
          Overall Performance
        </p>
        <ScoreRing score={overallScore} />
        <p className="text-[13px] text-[#64748b] mt-3">
          No campaigns running yet
        </p>
      </div>

      {/* ── Campaign Performance ────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[#e7e9ea]">Campaign Performance</h2>
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📊</span>
              </div>
              <p className="text-[15px] text-[#e7e9ea] font-medium">No campaign data</p>
              <p className="text-[13px] text-[#94a3b8] mt-1">Campaign performance will appear here</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Channel Performance ─────────────────────────── */}
      <div className="rounded-2xl bg-[#000000] border border-white/[0.08] p-4 space-y-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          <h2 className="text-[15px] font-semibold text-[#e7e9ea]">Channel Performance</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
              </div>
              <p className="text-[13px] text-[#94a3b8]">No channel data available</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#FFFFFF]/70 to-[#FFFFFF]" />
            <span className="text-[11px] text-[#64748b]">Impressions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#ffd700]/70 to-[#ffd700]" />
            <span className="text-[11px] text-[#64748b]">Clicks</span>
          </div>
        </div>
      </div>

      {/* ── A/B Test Results ────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
          </svg>
          <h2 className="text-[15px] font-semibold text-[#e7e9ea]">A/B Test Results</h2>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🧪</span>
              </div>
              <p className="text-[15px] text-[#e7e9ea] font-medium">No A/B tests running</p>
              <p className="text-[13px] text-[#94a3b8] mt-1">Set up tests to compare campaign variants</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Optimization Suggestions ─────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 017 7c0 3-2 5-4 6.5V18H9v-2.5C7 14 5 12 5 9a7 7 0 017-7z" />
            <path d="M9 18h6M10 22h4" />
          </svg>
          <h2 className="text-[15px] font-semibold text-[#e7e9ea]">AI Optimization</h2>
          <span className="px-2 py-0.5 rounded-full bg-[#FFFFFF]/10 text-[#FFFFFF] text-[11px] font-medium">
            Smart
          </span>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">💡</span>
              </div>
              <p className="text-[15px] text-[#e7e9ea] font-medium">No suggestions yet</p>
              <p className="text-[13px] text-[#94a3b8] mt-1">AI suggestions will appear as campaigns run</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
