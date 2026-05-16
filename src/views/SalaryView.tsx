'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { toast } from 'sonner'
import {
  calculatePayrollSummary,
  formatCurrency,
  type TeamMember,
} from '@/lib/business'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function SalaryView() {
  const navigate = useAppStore((s) => s.navigate)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])

  const summary = useMemo(() => calculatePayrollSummary(members), [members])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleMarkPaid = (id: string, name: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, paymentStatus: 'paid' as const, paymentDate: new Date().toISOString().split('T')[0] }
          : m
      )
    )
    toast.success(`Payment marked for ${name}`)
  }

  const handleProcessPayroll = () => {
    const pending = members.filter((m) => m.paymentStatus === 'pending')
    if (pending.length === 0) {
      toast.info('All payments have been processed')
      return
    }
    setMembers((prev) =>
      prev.map((m) =>
        m.paymentStatus === 'pending'
          ? { ...m, paymentStatus: 'paid' as const, paymentDate: new Date().toISOString().split('T')[0] }
          : m
      )
    )
    toast.success(`Payroll processed for ${pending.length} team member${pending.length > 1 ? 's' : ''}`)
  }

  const memberTotal = (m: TeamMember) =>
    m.baseSalary +
    m.commissions.reduce((s, c) => s + c.amount, 0) +
    m.incentives.reduce((s, i) => s + i.amount, 0)

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
        <h1 className="text-xl font-bold text-[#e7e9ea]">Salary Management</h1>
      </div>

      {/* ── Month Selector ──────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
        {MONTHS.map((month, idx) => (
          <button
            key={month}
            onClick={() => setSelectedMonth(idx)}
            className={cn(
              'shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200',
              selectedMonth === idx
                ? 'bg-[#FFFFFF] text-black'
                : 'bg-white/[0.04] text-[#94a3b8] hover:bg-white/[0.08] hover:text-[#e7e9ea]'
            )}
          >
            {month}
          </button>
        ))}
      </div>

      {/* ── Team Members ────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[#e7e9ea]">
          Team Members — {MONTHS[selectedMonth]} {new Date().getFullYear()}
        </h2>
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
          {members.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">👥</span>
                </div>
                <p className="text-[15px] text-[#e7e9ea] font-medium">No team members</p>
                <p className="text-[13px] text-[#94a3b8] mt-1">Add team members to manage their salaries</p>
              </div>
            </div>
          ) : (
          members.map((member) => {
            const totalCommission = member.commissions.reduce((s, c) => s + c.amount, 0)
            const totalIncentive = member.incentives.reduce((s, i) => s + i.amount, 0)
            const total = memberTotal(member)
            const isExpanded = expandedId === member.id

            return (
              <div
                key={member.id}
                className="rounded-2xl bg-[#000000] border border-white/[0.08] overflow-hidden"
              >
                {/* Member Card Header */}
                <button
                  onClick={() => toggleExpand(member.id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#FFFFFF]/15 flex items-center justify-center shrink-0">
                      <span className="text-[14px] font-bold text-[#FFFFFF]">
                        {member.avatar}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-semibold text-[#e7e9ea] truncate">
                            {member.name}
                          </p>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[11px] font-medium',
                              member.paymentStatus === 'paid'
                                ? 'bg-[#FFFFFF]/10 text-[#FFFFFF]'
                                : 'bg-[#ffd700]/10 text-[#ffd700]'
                            )}
                          >
                            {member.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </div>
                        <svg
                          className={cn(
                            'w-4 h-4 text-[#94a3b8] shrink-0 transition-transform duration-200',
                            isExpanded && 'rotate-180'
                          )}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                      <p className="text-[13px] text-[#64748b] mt-0.5">{member.role}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#94a3b8]">Base Salary</span>
                          <span className="text-[13px] text-[#e7e9ea] font-medium">
                            {formatCurrency(member.baseSalary)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#94a3b8]">Commission</span>
                          <span className="text-[13px] text-[#e7e9ea] font-medium">
                            {formatCurrency(totalCommission)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#94a3b8]">Incentives</span>
                          <span className="text-[13px] text-[#e7e9ea] font-medium">
                            {formatCurrency(totalIncentive)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#94a3b8] font-semibold">Total</span>
                          <span className="text-[13px] text-[#FFFFFF] font-bold">
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Commission Breakdown */}
                    <div>
                      <h3 className="text-[13px] font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">
                        Commission Breakdown
                      </h3>
                      <div className="space-y-1">
                        {member.commissions.map((comm, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02]"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-[#e7e9ea] truncate">{comm.sale}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-3">
                              <span className="text-[12px] text-[#94a3b8]">{comm.percentage}%</span>
                              <span className="text-[13px] text-[#FFFFFF] font-medium w-16 text-right">
                                {formatCurrency(comm.amount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Incentive Breakdown */}
                    <div>
                      <h3 className="text-[13px] font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">
                        Incentive Breakdown
                      </h3>
                      <div className="space-y-1">
                        {member.incentives.map((inc, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02]"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-[#e7e9ea]">{inc.type}</p>
                              <p className="text-[11px] text-[#64748b]">{inc.reason}</p>
                            </div>
                            <span className="text-[13px] text-[#ffd700] font-medium shrink-0 ml-3">
                              {formatCurrency(inc.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Status */}
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02]">
                      <div>
                        <p className="text-[13px] text-[#94a3b8]">Payment Status</p>
                        <p className="text-[12px] text-[#64748b]">
                          {member.paymentStatus === 'paid'
                            ? `Paid on ${member.paymentDate}`
                            : 'Awaiting processing'}
                        </p>
                      </div>
                      {member.paymentStatus === 'pending' && (
                        <button
                          onClick={() => handleMarkPaid(member.id, member.name)}
                          className="px-4 py-1.5 rounded-lg bg-[#FFFFFF] text-black text-[13px] font-semibold hover:bg-[#D1D5DB] transition-colors active:scale-[0.97]"
                        >
                          Mark as Paid
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
          )}
        </div>
      </div>

      {/* ── Payroll Summary ─────────────────────────────── */}
      <div className="rounded-2xl bg-[#000000] border border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="18" rx="2" />
            <path d="M2 9h20" />
            <path d="M2 15h20" />
          </svg>
          <h2 className="text-[15px] font-semibold text-[#e7e9ea]">Payroll Summary</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[14px] text-[#94a3b8]">Total Team Salary</span>
            <span className="text-[15px] text-[#e7e9ea] font-medium">
              {formatCurrency(summary.totalSalary)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[14px] text-[#94a3b8]">Total Commissions</span>
            <span className="text-[15px] text-[#e7e9ea] font-medium">
              {formatCurrency(summary.totalCommissions)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[14px] text-[#94a3b8]">Total Incentives</span>
            <span className="text-[15px] text-[#e7e9ea] font-medium">
              {formatCurrency(summary.totalIncentives)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5 border-t border-white/[0.06]">
            <span className="text-[15px] font-bold text-[#e7e9ea]">Grand Total</span>
            <span className="text-[18px] font-bold text-[#FFFFFF]">
              {formatCurrency(summary.grandTotal)}
            </span>
          </div>
        </div>
        <button
          onClick={handleProcessPayroll}
          className="w-full py-2.5 rounded-xl bg-[#FFFFFF] text-black text-[15px] font-bold hover:bg-[#D1D5DB] active:scale-[0.98] transition-all duration-200"
        >
          Process Payroll
        </button>
      </div>
    </div>
  )
}
