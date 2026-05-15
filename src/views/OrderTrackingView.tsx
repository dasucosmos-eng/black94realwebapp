'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/app'
import type { ShopOrder, OrderItem } from '@/lib/shop'
import { fetchBuyerOrders } from '@/lib/shop'

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const
const STATUS_LABELS: Record<string, string> = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  processing: 'bg-[#FFFFFF]',
  shipped: 'bg-cyan-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
  refunded: 'bg-orange-500',
}

const STATUS_TEXT_COLORS: Record<string, string> = {
  pending: 'text-yellow-400',
  confirmed: 'text-blue-400',
  processing: 'text-[#FFFFFF]',
  shipped: 'text-cyan-400',
  delivered: 'text-green-400',
  cancelled: 'text-red-400',
  refunded: 'text-orange-400',
}

function OrderTimeline({ order }: { order: ShopOrder }) {
  const currentIdx = STATUS_STEPS.indexOf(order.status as typeof STATUS_STEPS[number])
  const isCancelled = order.status === 'cancelled'
  const isRefunded = order.status === 'refunded'

  return (
    <div className="p-4 rounded-xl bg-[#000000] border border-white/[0.06]">
      <h3 className="text-[14px] font-bold text-[#e7e9ea] mb-5">Order Status</h3>

      {/* Current status badge */}
      <div className="flex items-center gap-2 mb-5">
        <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-500'}`} />
        <span className={`text-[15px] font-bold ${STATUS_TEXT_COLORS[order.status] || 'text-[#e7e9ea]'}`}>
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative pl-8">
        {STATUS_STEPS.map((step, i) => {
          const isCompleted = isCancelled || isRefunded ? false : currentIdx >= i
          const isCurrent = order.status === step
          const isLast = i === STATUS_STEPS.length - 1

          return (
            <div key={step} className="relative mb-6 last:mb-0">
              {/* Vertical line */}
              {!isLast && (
                <div className={`absolute left-[-21px] top-5 w-0.5 h-full ${isCompleted ? 'bg-[#FFFFFF]' : 'bg-white/[0.08]'}`} />
              )}

              {/* Dot */}
              <div className={`absolute left-[-25px] top-1 w-3 h-3 rounded-full border-2 transition-all ${
                isCompleted
                  ? 'bg-[#FFFFFF] border-[#FFFFFF]'
                  : isCurrent
                    ? 'border-[#FFFFFF] bg-[#000000]'
                    : 'border-[#64748b] bg-[#000000]'
              }`} />

              {/* Label */}
              <div>
                <p className={`text-[13px] font-medium ${isCompleted ? 'text-[#e7e9ea]' : 'text-[#64748b]'}`}>
                  {STATUS_LABELS[step]}
                </p>
                {isCurrent && (
                  <p className="text-[11px] text-[#94a3b8] mt-0.5">Current status</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {isCancelled && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-[13px] text-red-400">This order has been cancelled</p>
        </div>
      )}
      {isRefunded && (
        <div className="mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <p className="text-[13px] text-orange-400">This order has been refunded</p>
        </div>
      )}
    </div>
  )
}

export function OrderTrackingView() {
  const user = useAppStore((s) => s.user)
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const result = await fetchBuyerOrders(user.id)
        setOrders(result)
        if (result.length > 0) setSelectedOrder(result[0])
      } catch {
        setOrders([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-53px-50px)]">
        <div className="w-8 h-8 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-53px-50px)] px-4">
        <div className="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </div>
        <h2 className="text-[18px] font-bold text-[#e7e9ea] mb-2">No orders yet</h2>
        <p className="text-[14px] text-[#94a3b8] mb-6">Your order history will appear here</p>
        <button
          onClick={() => useAppStore.getState().navigate('store')}
          className="px-8 py-3 rounded-full bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] text-black font-bold text-[15px]"
        >
          Start Shopping
        </button>
      </div>
    )
  }

  const order = selectedOrder || orders[0]
  let items: OrderItem[] = []
  try { items = JSON.parse(order.items) } catch { /* ignore */ }

  let shippingAddress: { name: string; line1: string; line2?: string; city: string; state: string; pincode: string; phone: string } | null = null
  try { shippingAddress = JSON.parse(order.shippingAddress) } catch { /* ignore */ }

  return (
    <div className="min-h-[calc(100vh-53px-50px)] pb-24">
      {/* Order Selector */}
      {orders.length > 1 && (
        <div className="px-4 pt-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
                  selectedOrder?.id === o.id
                    ? 'bg-[#FFFFFF] text-black'
                    : 'bg-white/[0.06] text-[#94a3b8] hover:bg-white/[0.1]'
                }`}
              >
                #{o.id.slice(-6)} • ₹{o.total.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 mt-4 space-y-4">
        {/* Timeline */}
        <OrderTimeline order={order} />

        {/* Order Info */}
        <div className="p-4 rounded-xl bg-[#000000] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-[#e7e9ea]">Order #{order.id.slice(-8).toUpperCase()}</h3>
            <span className="text-[12px] text-[#94a3b8]">{new Date(order.createdAt).toLocaleDateString()}</span>
          </div>

          {/* Items */}
          <div className="space-y-3 mb-4">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#14112a] flex-shrink-0">
                  <img src={item.image || '/placeholder-product.png'} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#e7e9ea] line-clamp-1">{item.productName}</p>
                  <p className="text-[12px] text-[#94a3b8]">Qty: {item.quantity}{item.variant ? ` • ${item.variant}` : ''}</p>
                </div>
                <span className="text-[13px] font-semibold text-[#e7e9ea]">₹{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-white/[0.06] pt-3 space-y-1.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-[#94a3b8]">Subtotal</span>
              <span className="text-[#e7e9ea]">₹{order.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#94a3b8]">Shipping</span>
              <span className="text-[#e7e9ea]">{order.shipping === 0 ? 'FREE' : `₹${order.shipping.toLocaleString()}`}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#94a3b8]">Tax</span>
              <span className="text-[#e7e9ea]">₹{order.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[15px] font-bold pt-1">
              <span className="text-[#e7e9ea]">Total</span>
              <span className="text-[#FFFFFF]">₹{order.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        {shippingAddress && (
          <div className="p-4 rounded-xl bg-[#000000] border border-white/[0.06]">
            <h3 className="text-[14px] font-bold text-[#e7e9ea] mb-2">Delivery Address</h3>
            <p className="text-[13px] text-[#e7e9ea]">{shippingAddress.name}</p>
            <p className="text-[13px] text-[#94a3b8]">{shippingAddress.line1}</p>
            {shippingAddress.line2 && <p className="text-[13px] text-[#94a3b8]">{shippingAddress.line2}</p>}
            <p className="text-[13px] text-[#94a3b8]">{shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pincode}</p>
            <p className="text-[13px] text-[#94a3b8]">{shippingAddress.phone}</p>
          </div>
        )}

        {/* Tracking */}
        {order.trackingNumber && (
          <div className="p-4 rounded-xl bg-[#000000] border border-white/[0.06]">
            <h3 className="text-[14px] font-bold text-[#e7e9ea] mb-2">Tracking</h3>
            <p className="text-[13px] text-[#94a3b8]">Partner: {order.trackingPartner || 'N/A'}</p>
            <p className="text-[13px] text-[#FFFFFF] font-mono">{order.trackingNumber}</p>
          </div>
        )}
      </div>
    </div>
  )
}
