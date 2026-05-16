/* ═══════════════════════════════════════════════════════════════════════════
   CRM & Ads — Types & Utilities
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Lead {
  id: string
  businessId: string
  name: string
  email: string
  phone: string
  source: 'Ad' | 'Organic' | 'Referral' | 'Chat'
  aiScore: number
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost'
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Deal {
  id: string
  name: string
  value: number
  contactName: string
  stage: 'New' | 'Contacted' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost'
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  customerName: string
  product: string
  amount: number
  status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled'
  date: string
}

export interface AdCampaign {
  id: string
  name: string
  headline: string
  description: string
  ctaText: string
  ctaUrl: string
  budget: number
  duration: number
  targetAge: string
  targetLocation: string
  interests: string[]
  status: 'Active' | 'Paused' | 'Ended'
  impressions: number
  clicks: number
  spend: number
  conversions: number
  createdAt: string
}

export interface CrmAnalytics {
  totalRevenue: number
  totalLeads: number
  conversionRate: number
  avgDealSize: number
  customerLifetimeValue: number
  activeCustomers: number
}

/* ── Data (populated from server) ──────────────────────────────────────────────────── */

export const leadsData: Lead[] = []

export const dealsData: Deal[] = []

export const ordersData: Order[] = []

export const adCampaignsData: AdCampaign[] = []

export const crmAnalytics: CrmAnalytics = {
  totalRevenue: 0,
  totalLeads: 0,
  conversionRate: 0,
  avgDealSize: 0,
  customerLifetimeValue: 0,
  activeCustomers: 0,
}

export const monthlyRevenueData: { month: string; revenue: number }[] = []

export const dailyImpressionsData: { day: string; impressions: number }[] = []

export const leadSourceData: { source: string; count: number; color: string }[] = []

export const topProductsData: { name: string; revenue: number }[] = []

export const acquisitionTrend: { month: string; customers: number }[] = []

export const recentActivity: { id: string; text: string; time: string; type: 'success' | 'warning' | 'info' | 'neutral' }[] = []

/* ── Utility Functions ──────────────────────────────────────────────────── */

export function getLeadScoreColor(score: number): string {
  if (score > 80) return 'text-[#FFFFFF]'
  if (score >= 50) return 'text-[#ffd700]'
  return 'text-[#ff6b6b]'
}

export function getLeadScoreBg(score: number): string {
  if (score > 80) return 'bg-[#FFFFFF]/15 text-[#FFFFFF]'
  if (score >= 50) return 'bg-[#ffd700]/15 text-[#ffd700]'
  return 'bg-[#ff6b6b]/15 text-[#ff6b6b]'
}

export function getStageColor(stage: string): string {
  switch (stage) {
    case 'New': return 'bg-blue-500/15 text-blue-400'
    case 'Contacted': return 'bg-yellow-500/15 text-yellow-400'
    case 'Proposal': return 'bg-[#FFFFFF]/15 text-[#FFFFFF]'
    case 'Negotiation': return 'bg-orange-500/15 text-orange-400'
    case 'Won': return 'bg-[#FFFFFF]/15 text-[#FFFFFF]'
    case 'Lost': return 'bg-red-500/15 text-red-400'
    default: return 'bg-white/10 text-[#94a3b8]'
  }
}

export function getOrderStatusColor(status: string): string {
  switch (status) {
    case 'Pending': return 'bg-yellow-500/15 text-yellow-400'
    case 'Processing': return 'bg-blue-500/15 text-blue-400'
    case 'Shipped': return 'bg-[#FFFFFF]/15 text-[#FFFFFF]'
    case 'Delivered': return 'bg-[#FFFFFF]/15 text-[#FFFFFF]'
    case 'Cancelled': return 'bg-red-500/15 text-red-400'
    default: return 'bg-white/10 text-[#94a3b8]'
  }
}

export function getAdStatusColor(status: string): string {
  switch (status) {
    case 'Active': return 'bg-[#FFFFFF]/15 text-[#FFFFFF]'
    case 'Paused': return 'bg-yellow-500/15 text-yellow-400'
    case 'Ended': return 'bg-white/10 text-[#94a3b8]'
    default: return 'bg-white/10 text-[#94a3b8]'
  }
}

export function getLeadSourceColor(source: string): string {
  switch (source) {
    case 'Ad': return 'bg-[#FFFFFF]/15 text-[#FFFFFF]'
    case 'Organic': return 'bg-[#ffd700]/15 text-[#ffd700]'
    case 'Referral': return 'bg-[#FFFFFF]/15 text-[#FFFFFF]'
    case 'Chat': return 'bg-blue-500/15 text-blue-400'
    default: return 'bg-white/10 text-[#94a3b8]'
  }
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
