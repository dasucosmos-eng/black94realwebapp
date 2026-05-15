'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { toast } from 'sonner'
import {
  type Affiliate,
} from '@/lib/business'

const FREE_BADGES = 9999
const BADGE_COST = 0

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function AffiliatesView() {
  const navigate = useAppStore((s) => s.navigate)

  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('')
  const [purchaseQty, setPurchaseQty] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')

  const activeAffiliates = useMemo(
    () => affiliates.filter((a) => a.status === 'active'),
    [affiliates]
  )
  const freeBadgesUsed = activeAffiliates.length
  const freeBadgesRemaining = Math.max(0, FREE_BADGES - freeBadgesUsed)
  const allFreeUsed = freeBadgesRemaining === 0

  const handleAssignBadge = () => {
    if (!newName.trim() || !newEmail.trim() || !newRole.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    if (!allFreeUsed) {
      const newAffiliate: Affiliate = {
        id: `aff-${Date.now()}`,
        name: newName.trim(),
        email: newEmail.trim(),
        role: newRole.trim(),
        businessName: 'NovaTech Solutions',
        badgeAssignedAt: new Date().toISOString(),
        status: 'active',
      }
      setAffiliates((prev) => [...prev, newAffiliate])
      setNewName('')
      setNewEmail('')
      setNewRole('')
      toast.success(`Badge assigned to ${newAffiliate.name}`)
    }
  }

  const handleRevoke = (id: string, name: string) => {
    setAffiliates((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'revoked' as const } : a)))
    toast.success(`Badge revoked from ${name}`)
  }

  const handleEditSave = (id: string) => {
    if (!editRole.trim()) {
      toast.error('Role cannot be empty')
      return
    }
    setAffiliates((prev) =>
      prev.map((a) => (a.id === id ? { ...a, role: editRole.trim() } : a))
    )
    setEditingId(null)
    setEditRole('')
    toast.success('Role updated')
  }

  const handlePurchase = () => {
    toast.info('Badge purchase is currently unavailable. Try again later.')
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
        <h1 className="text-xl font-bold text-[#e7e9ea]">Affiliate Badges</h1>
      </div>

      {/* ── Plan Info Card ──────────────────────────────── */}
      <div className="rounded-2xl bg-[#000000] border border-white/[0.08] p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFFFFF]/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#e7e9ea]">Business Plan</p>
            <p className="text-[13px] text-[#94a3b8]">Unlimited badges included</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] transition-all duration-500"
              style={{ width: `${Math.min((freeBadgesUsed / FREE_BADGES) * 100, 100)}%` }}
            />
          </div>
          <span className="text-[13px] text-[#94a3b8] shrink-0">
            {freeBadgesUsed}/{FREE_BADGES} used
          </span>
        </div>
      </div>

      {/* ── Active Affiliates ───────────────────────────── */}
      {activeAffiliates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[15px] font-semibold text-[#e7e9ea]">Active Affiliates</h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
            {activeAffiliates.map((affiliate) => (
              <div
                key={affiliate.id}
                className="rounded-2xl bg-[#000000] border border-white/[0.08] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#FFFFFF]/15 flex items-center justify-center shrink-0">
                    <span className="text-[14px] font-bold text-[#FFFFFF]">
                      {getInitials(affiliate.name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[15px] font-semibold text-[#e7e9ea] truncate">
                        {affiliate.name}
                      </p>
                    </div>
                    <p className="text-[13px] text-[#64748b] truncate">{affiliate.email}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFFFFF]/10 border border-[#FFFFFF]/20 text-[#FFFFFF] text-[12px] font-medium">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                        Verified Agent — {affiliate.businessName}
                      </span>
                    </div>
                    {editingId === affiliate.id ? (
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="text"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="flex-1 bg-transparent border border-white/[0.08] rounded-lg px-3 py-1.5 text-[14px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
                          placeholder="Role/Title"
                        />
                        <button
                          onClick={() => handleEditSave(affiliate.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] text-black text-[13px] font-semibold hover:bg-[#D1D5DB] transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-[#94a3b8] text-[13px] font-medium hover:bg-white/[0.1] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[13px] text-[#94a3b8]">
                            {affiliate.role}
                          </span>
                          <span className="text-[13px] text-[#64748b]">
                            Since {formatDate(affiliate.badgeAssignedAt)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      {editingId !== affiliate.id && (
                        <button
                          onClick={() => {
                            setEditingId(affiliate.id)
                            setEditRole(affiliate.role)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-[#e7e9ea] text-[13px] font-medium hover:bg-white/[0.1] transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleRevoke(affiliate.id, affiliate.name)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-medium hover:bg-red-500/20 transition-colors"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add Affiliate Section ───────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[#e7e9ea]">Add New Affiliate</h2>
        <div className="rounded-2xl bg-[#000000] border border-white/[0.08] p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[13px] text-[#94a3b8]">Full Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter full name"
              className="w-full bg-transparent border border-white/[0.08] rounded-xl px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-[#94a3b8]">Email Address</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter email address"
              className="w-full bg-transparent border border-white/[0.08] rounded-xl px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-[#94a3b8]">Role / Title</label>
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="e.g. Sales Lead, Account Executive"
              className="w-full bg-transparent border border-white/[0.08] rounded-xl px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
            />
          </div>
          {!allFreeUsed ? (
            <button
              onClick={handleAssignBadge}
              disabled={!newName.trim() || !newEmail.trim() || !newRole.trim()}
              className={cn(
                'w-full py-2.5 rounded-xl text-[15px] font-bold transition-all duration-200',
                newName.trim() && newEmail.trim() && newRole.trim()
                  ? 'bg-[#FFFFFF] text-black hover:bg-[#D1D5DB] active:scale-[0.98]'
                  : 'bg-white/[0.06] text-[#64748b] cursor-not-allowed'
              )}
            >
              Assign Badge
            </button>
          ) : (
            <div className="text-center py-2">
              <p className="text-[13px] text-[#94a3b8] mb-1">No free badges remaining</p>
            </div>
          )}
        </div>
      </div>


    </div>
  )
}
