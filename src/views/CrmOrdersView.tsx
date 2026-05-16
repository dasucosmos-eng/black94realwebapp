'use client'

import { useAppStore } from '@/stores/app'
import { cn } from '@/lib/utils'
import { getOrderStatusColor, formatCurrency, type Order } from '@/lib/crm'

const STATUS_ICONS: Record<string, string> = {
  Pending: '⏳',
  Processing: '⚙️',
  Shipped: '🚚',
  Delivered: '✅',
  Cancelled: '❌',
}

export function CrmOrdersView() {
  const navigate = useAppStore((s) => s.navigate)

  const orders: Order[] = []

  const totalOrders = orders.length
  const pending = orders.filter(o => o.status === 'Pending').length
  const shipped = orders.filter(o => o.status === 'Shipped').length
  const delivered = orders.filter(o => o.status === 'Delivered').length

  return (
    <div className="px-4 pt-2 pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('business-dashboard')} className="p-2 -ml-2 rounded-full hover:bg-white/[0.06] transition-colors">
          <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h1 className="text-xl font-bold text-[#e7e9ea]">Orders</h1>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total', value: totalOrders, color: 'text-[#e7e9ea]' },
          { label: 'Pending', value: pending, color: 'text-yellow-400' },
          { label: 'Shipped', value: shipped, color: 'text-[#FFFFFF]' },
          { label: 'Delivered', value: delivered, color: 'text-[#FFFFFF]' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-[#000000] border border-white/[0.06] p-3 text-center">
            <p className={cn('text-xl font-bold', stat.color)}>{stat.value}</p>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-2">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">📦</span>
            </div>
            <p className="text-[15px] text-[#e7e9ea] font-medium">No orders yet</p>
            <p className="text-[13px] text-[#94a3b8] mt-1">Orders will appear here once customers make purchases</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="rounded-xl bg-[#000000] border border-white/[0.06] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-mono text-[#94a3b8]">{order.id}</p>
                <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full', getOrderStatusColor(order.status))}>
                  <span className="text-[10px]">{STATUS_ICONS[order.status] || ''}</span>
                  {order.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-[14px] font-semibold text-[#e7e9ea] truncate">{order.customerName}</h4>
                  <p className="text-[13px] text-[#94a3b8] truncate">{order.product}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[15px] font-bold text-[#FFFFFF] block">{formatCurrency(order.amount)}</span>
                  <span className="text-[11px] text-[#64748b]">{order.date}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
