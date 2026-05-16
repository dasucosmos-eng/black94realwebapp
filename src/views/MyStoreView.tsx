'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/app'
import type { ShopProduct, ShopOrder } from '@/lib/shop'
import { fetchBusinessProducts, fetchBusinessOrders, deleteProduct } from '@/lib/shop'
import { toast } from 'sonner'

export function MyStoreView() {
  const user = useAppStore((s) => s.user)
  const navigate = useAppStore((s) => s.navigate)
  const businessId = user?.id || ''

  const [products, setProducts] = useState<ShopProduct[]>([])
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products')

  const totalRevenue = orders.reduce((sum, o) => sum + (o.status !== 'cancelled' && o.status !== 'refunded' ? o.total : 0), 0)
  const activeOrders = orders.filter((o) => !['delivered', 'cancelled', 'refunded'].includes(o.status)).length

  const loadStore = async () => {
    setLoading(true)
    try {
      const [prodRes, ordRes] = await Promise.all([
        fetchBusinessProducts(businessId, 50),
        fetchBusinessOrders(businessId),
      ])
      setProducts(prodRes.products)
      setOrders(ordRes)
    } catch (err) {
      console.error('MyStore load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (businessId) loadStore()
  }, [businessId])

  const handleDeleteProduct = async (productId: string, name: string) => {
    try {
      await deleteProduct(productId)
      setProducts((prev) => prev.filter((p) => p.id !== productId))
      toast.success(`"${name}" deleted`)
    } catch {
      toast.error('Failed to delete product')
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-400',
    confirmed: 'bg-blue-500/15 text-blue-400',
    processing: 'bg-[#FFFFFF]/15 text-[#FFFFFF]',
    shipped: 'bg-cyan-500/15 text-cyan-400',
    delivered: 'bg-green-500/15 text-green-400',
    cancelled: 'bg-red-500/15 text-red-400',
    refunded: 'bg-orange-500/15 text-orange-400',
  }

  return (
    <div className="min-h-[calc(100vh-53px-50px)] pb-24">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 px-4 mt-3">
        <div className="bg-[#000000] border border-white/[0.06] rounded-xl p-3.5 text-center">
          <div className="w-9 h-9 rounded-lg bg-[#FFFFFF]/10 flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
          </div>
          <p className="text-[20px] font-bold text-[#e7e9ea]">{products.length}</p>
          <p className="text-[11px] text-[#94a3b8]">Products</p>
        </div>
        <div className="bg-[#000000] border border-white/[0.06] rounded-xl p-3.5 text-center">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <p className="text-[20px] font-bold text-[#e7e9ea]">{activeOrders}</p>
          <p className="text-[11px] text-[#94a3b8]">Active</p>
        </div>
        <div className="bg-[#000000] border border-white/[0.06] rounded-xl p-3.5 text-center">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          </div>
          <p className="text-[20px] font-bold text-[#e7e9ea]">₹{(totalRevenue / 1000).toFixed(1)}k</p>
          <p className="text-[11px] text-[#94a3b8]">Revenue</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mx-4 mt-5 p-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
        {(['products', 'orders'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-full text-[13px] font-semibold capitalize transition-all ${
              activeTab === tab ? 'bg-[#FFFFFF] text-black shadow-md' : 'text-[#94a3b8] hover:text-[#e7e9ea]'
            }`}
          >
            {tab} ({tab === 'products' ? products.length : orders.length})
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-4 px-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
          </div>
        ) : activeTab === 'products' ? (
          <div className="space-y-2">
            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[14px] text-[#94a3b8] mb-4">No products yet</p>
                <button
                  onClick={() => navigate('add-product')}
                  className="px-6 py-2.5 rounded-full bg-[#FFFFFF] text-black font-bold text-sm"
                >
                  Add Your First Product
                </button>
              </div>
            ) : (
              products.map((product) => (
                <div key={product.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#000000] border border-white/[0.06]">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#14112a] flex-shrink-0">
                    {product.images ? (
                      <img src={product.images.split(',')[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#14112a]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#e7e9ea] line-clamp-1">{product.name}</p>
                    <p className="text-[13px] font-semibold text-[#FFFFFF]">₹{product.price.toLocaleString()}</p>
                    <p className="text-[11px] text-[#94a3b8]">{product.stock} in stock • {product.soldCount} sold</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => navigate('add-product', { id: product.id })}
                      className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1]"
                    >
                      <svg className="w-4 h-4 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id, product.name)}
                      className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center hover:bg-red-500/20"
                    >
                      <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[14px] text-[#94a3b8]">No orders yet</p>
              </div>
            ) : (
              orders.map((order) => {
                let items: { productName: string; quantity: number }[] = []
                try { items = JSON.parse(order.items) } catch { /* ignore */ }
                return (
                  <button
                    key={order.id}
                    onClick={() => navigate('business-orders')}
                    className="w-full text-left p-3 rounded-xl bg-[#000000] border border-white/[0.06]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-[#94a3b8]">{new Date(order.createdAt).toLocaleDateString()}</span>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${statusColors[order.status] || ''}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#e7e9ea] line-clamp-1">{order.buyerName}</p>
                    <p className="text-[12px] text-[#94a3b8]">{items.map((i) => i.productName).join(', ')}</p>
                    <p className="text-[14px] font-bold text-[#FFFFFF] mt-1">₹{order.total.toLocaleString()}</p>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* FAB: Add Product */}
      <button
        onClick={() => navigate('add-product')}
        className="fixed bottom-[68px] right-4 z-20 w-14 h-14 rounded-full bg-gradient-to-br from-[#FFFFFF] to-[#D1D5DB] flex items-center justify-center shadow-lg shadow-[#FFFFFF]/30 hover:scale-110 active:scale-90 transition-all"
      >
        <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  )
}
