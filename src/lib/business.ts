// ═══════════════════════════════════════════════════════════════
// Business Types & Utilities for Black94
// ═══════════════════════════════════════════════════════════════

export interface Affiliate {
  id: string
  name: string
  email: string
  role: string
  businessName: string
  badgeAssignedAt: string
  status: 'active' | 'revoked'
}

export interface Commission {
  sale: string
  amount: number
  percentage: number
}

export interface Incentive {
  type: string
  amount: number
  reason: string
}

export interface TeamMember {
  id: string
  name: string
  role: string
  avatar: string
  baseSalary: number
  commissions: Commission[]
  incentives: Incentive[]
  paymentStatus: 'paid' | 'pending'
  paymentDate: string | null
}

export interface PayrollSummary {
  totalSalary: number
  totalCommissions: number
  totalIncentives: number
  grandTotal: number
}

export interface CampaignPerformance {
  id: string
  name: string
  impressions: number
  clicks: number
  ctr: number
  conversions: number
  roi: number
  budget: number
  budgetUsed: number
  status: 'active' | 'paused' | 'completed'
}

export interface ChannelPerformance {
  channel: string
  impressions: number
  clicks: number
  ctr: number
}

export interface ABTest {
  id: string
  name: string
  variantA: {
    impressions: number
    clicks: number
    conversions: number
  }
  variantB: {
    impressions: number
    clicks: number
    conversions: number
  }
  winner: 'A' | 'B' | null
}

export interface AISuggestion {
  id: string
  text: string
  impact: 'high' | 'medium' | 'low'
  category: string
}

// ── Default data arrays (populated from server) ──────────────────────────────

export const affiliatesData: Affiliate[] = []

export const teamMembersData: TeamMember[] = []

export const campaignPerformanceData: CampaignPerformance[] = []

export const channelPerformanceData: ChannelPerformance[] = []

export const abTestsData: ABTest[] = []

export const aiSuggestionsData: AISuggestion[] = []

// ── Utility Functions ────────────────────────────────────────

export function calculatePayrollSummary(members: TeamMember[]): PayrollSummary {
  const totalSalary = members.reduce((sum, m) => sum + m.baseSalary, 0)
  const totalCommissions = members.reduce(
    (sum, m) => sum + m.commissions.reduce((s, c) => s + c.amount, 0),
    0
  )
  const totalIncentives = members.reduce(
    (sum, m) => sum + m.incentives.reduce((s, i) => s + i.amount, 0),
    0
  )
  return {
    totalSalary,
    totalCommissions,
    totalIncentives,
    grandTotal: totalSalary + totalCommissions + totalIncentives,
  }
}

export function calculateOverallScore(campaigns: CampaignPerformance[]): number {
  if (campaigns.length === 0) return 0
  const avgCtr = campaigns.reduce((s, c) => s + c.ctr, 0) / campaigns.length
  const avgRoi = campaigns.reduce((s, c) => s + c.roi, 0) / campaigns.length
  const ctrScore = Math.min(avgCtr / 8, 1) * 40
  const roiScore = Math.min(avgRoi / 700, 1) * 40
  const budgetEfficiency =
    campaigns.reduce((s, c) => s + c.budgetUsed / c.budget, 0) / campaigns.length
  const budgetScore = Math.min(budgetEfficiency, 1) * 20
  return Math.round(ctrScore + roiScore + budgetScore)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}
