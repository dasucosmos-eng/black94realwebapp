'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/app'
import type { ShopOrder, OrderItem } from '@/lib/shop'
import { fetchBusinessOrders, updateOrderStatus } from '@/lib/shop'
import { toast } from 'sonner'

const STATUS_OPTIONS: { value: ShopOrder['status']; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'text-yellow-400 bg-yellow-500/15' },
  { value: 'confirmed', label: 'Confirmed', color: 'text-blue-400 bg-blue-500/15' },
  { value: 'processing', label: 'Processing', color: 'text-[#FFFFFF] bg-[#FFFFFF]/15' },
  { value: 'shipped', label: 'Shipped', color: 'text-cyan-400 bg-cyan-500/15' },
  { value: 'delivered', label: 'Delivered', color: 'text-green-400 bg-green-500/15' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-red-400 bg-red-500/15' },
  { value: 'refunded', label: 'Refunded', color: 'text-orange-400 bg-orange-500/15' },
]

const FILTER_OPTIONS = ['All', 'Active', 'Completed', 'Cancelled'] as const

export function BusinessOrdersView() {
  const user = useAppStore((s) => s.user)
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>('All')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [trackingInput, setTrackingInput] = useState<Record<string, string>>({})
  const [updating, setUpdating] = useState<string | null>(null)

  const filteredOrders = orders.filter((o) => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'Active') return ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)
    if (activeFilter === 'Completed') return o.status === 'delivered'
    if (activeFilter === 'Cancelled') return ['cancelled', 'refunded'].includes(o.status)
    return true
  })

  const totalRevenue = orders
    .filter((o) => !['cancelled', 'refunded'].includes(o.status))
    .reduce((sum, o) => sum + o.total, 0)
  const pendingOrders = orders.filter((o) => ['pending', 'confirmed'].includes(o.status)).length

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const result = await fetchBusinessOrders(user.id)
        setOrders(result)
      } catch {
        setOrders([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const handleStatusChange = async (orderId: string, status: ShopOrder['status']) => {
    setUpdating(orderId)
    try {
      const trackingNum = trackingInput[orderId]
      await updateOrderStatus(orderId, status, trackingNum)
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status, trackingNumber: trackingNum || o.trackingNumber }
            : o
        )
      )
      toast.success(`Order ${status}`)
    } catch {
      toast.error('Failed to update order')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="min-h-[calc(100vh-53px-50px)] pb-24">
      {/* Revenue Summary */}
      <div className="mx-4 mt-3 p-4 rounded-xl bg-gradient-to-r from-[#FFFFFF]/10 via-transparent to-[#ffd700]/5 border border-[#FFFFFF]/20">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] text-[#94a3b8] uppercase tracking-wider">Total Revenue</p>
            <p className="text-[22px] font-bold text-[#FFFFFF]">₹{totalRevenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-[#94a3b8] uppercase tracking-wider">Pending Orders</p>
            <p className="text-[22px] font-bold text-amber-400">{pendingOrders}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 mt-5 overflow-x-auto scrollbar-none">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
              activeFilter === f
                ? 'bg-[#FFFFFF] text-black'
                : 'bg-white/[0.06] text-[#94a3b8] hover:text-[#e7e9ea]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[14px] text-[#94a3b8]">No orders found</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            let items: OrderItem[] = []
            try { items = JSON.parse(order.items) } catch { /* ignore */ }
            const isExpanded = expandedOrder === order.id

            return (
              <div key={order.id} className="rounded-xl bg-[#000000] border border-white/[0.06] overflow-hidden">
                {/* Order Header */}
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[#94a3b8] font-mono">#{order.id.slice(-8).toUpperCase()}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_OPTIONS.find((s) => s.value === order.status)?.color || ''}`}>
                        {order.status}
                      </span>
                    </div>
                    <svg className={`w-4 h-4 text-[#94a3b8] transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-[13px] text-[#e7e9ea] font-medium">{order.buyerName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[12px] text-[#94a3b8]">{new Date(order.createdAt).toLocaleDateString()}</p>
                    <p className="text-[15px] font-bold text-[#FFFFFF]">₹{order.total.toLocaleString()}</p>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] p-4 space-y-4">
                    {/* Items */}
                    <div>
                      <h4 className="text-[12px] text-[#94a3b8] uppercase tracking-wider mb-2">Items</h4>
                      <div className="space-y-2">
                        {items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#14112a] flex-shrink-0">
                              <img src={item.image || '/placeholder-product.png'} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-[#e7e9ea] line-clamp-1">{item.productName}</p>
                              <p className="text-[11px] text-[#94a3b8]">x{item.quantity}</p>
                            </div>
                            <span className="text-[12px] font-semibold text-[#e7e9ea]">₹{(item.price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status Update */}
                    <div>
                      <h4 className="text-[12px] text-[#94a3b8] uppercase tracking-wider mb-2">Update Status</h4>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleStatusChange(order.id, opt.value)}
                            disabled={updating === order.id || order.status === opt.value}
                            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                              order.status === opt.value
                                ? opt.color
                                : 'bg-white/[0.06] text-[#94a3b8] hover:bg-white/[0.1] disabled:opacity-50'
                            }`}
                          >
                            {updating === order.id ? '...' : opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tracking Number */}
                    <div>
                      <h4 className="text-[12px] text-[#94a3b8] uppercase tracking-wider mb-2">Tracking Number</h4>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={trackingInput[order.id] || ''}
                          onChange={(e) => setTrackingInput((prev) => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder={order.trackingNumber || 'Enter tracking number'}
                          className="flex-1 bg-transparent border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
                        />
                        <button
                          onClick={() => {
                            if (!trackingInput[order.id]?.trim()) return
                            handleStatusChange(order.id, order.status)
                          }}
                          className="px-4 py-2 rounded-lg bg-[#FFFFFF]/10 text-[#FFFFFF] text-[13px] font-medium hover:bg-[#FFFFFF]/20 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                      {order.trackingNumber && (
                        <p className="text-[11px] text-[#94a3b8] mt-1">Current: {order.trackingNumber} ({order.trackingPartner})</p>
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
  )
}
