'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import type { ShopProduct, ShopOrder, OrderItem } from '@/lib/shop'
import { fetchBusinessProducts, fetchBusinessOrders, deleteProduct, updateProduct, updateOrderStatus } from '@/lib/shop'
import { VerifiedBadge } from '@/components/PAvatar'
import { toast } from 'sonner'

/* ── Types ────────────────────────────────────────────────────────────────── */

type DashTab = 'overview' | 'products' | 'inventory' | 'orders' | 'settings'

interface StoreSettings {
  storeName: string
  storeDescription: string
  storeCover: string
  shippingEnabled: boolean
  freeShippingAbove: string
  returnPolicy: string
  defaultShippingPartner: string
  taxRate: string
  currency: string
}

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: '',
  storeDescription: '',
  storeCover: '',
  shippingEnabled: true,
  freeShippingAbove: '500',
  returnPolicy: '7 days return policy',
  defaultShippingPartner: '',
  taxRate: '18',
  currency: 'INR',
}

/* ── Status Colors ────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-500/15',
  confirmed: 'text-blue-400 bg-blue-500/15',
  processing: 'text-[#FFFFFF] bg-[#FFFFFF]/15',
  shipped: 'text-cyan-400 bg-cyan-500/15',
  delivered: 'text-green-400 bg-green-500/15',
  cancelled: 'text-red-400 bg-red-500/15',
  refunded: 'text-orange-400 bg-orange-500/15',
}

/* ═══════════════════════════════════════════════════════════════════════════
   CUSTOM HEADER — Back nav + Title
   ═══════════════════════════════════════════════════════════════════════════ */

function DashHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="sticky top-0 z-40 bg-[#000000]/95 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="flex items-center gap-3 px-4 h-[53px]">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors -ml-1"
        >
          <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#e7e9ea]">{title}</h1>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION TABS
   ═══════════════════════════════════════════════════════════════════════════ */

const DASH_TABS: { key: DashTab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: (active) => (
      <svg className={cn('w-[18px] h-[18px]', active ? 'text-[#FFFFFF]' : 'text-[#94a3b8]')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    key: 'products',
    label: 'Products',
    icon: (active) => (
      <svg className={cn('w-[18px] h-[18px]', active ? 'text-[#FFFFFF]' : 'text-[#94a3b8]')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: (active) => (
      <svg className={cn('w-[18px] h-[18px]', active ? 'text-[#FFFFFF]' : 'text-[#94a3b8]')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      </svg>
    ),
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: (active) => (
      <svg className={cn('w-[18px] h-[18px]', active ? 'text-[#FFFFFF]' : 'text-[#94a3b8]')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: (active) => (
      <svg className={cn('w-[18px] h-[18px]', active ? 'text-[#FFFFFF]' : 'text-[#94a3b8]')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
]

function SectionTabs({ active, onChange }: { active: DashTab; onChange: (tab: DashTab) => void }) {
  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-x-auto no-scrollbar">
        {DASH_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all flex-shrink-0',
              active === tab.key
                ? 'bg-[#FFFFFF] text-black shadow-md shadow-[#FFFFFF]/20'
                : 'text-[#94a3b8] hover:text-[#e7e9ea]'
            )}
          >
            {tab.icon(active === tab.key)}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewSection({ products, orders }: { products: ShopProduct[]; orders: ShopOrder[] }) {
  const totalRevenue = orders
    .filter((o) => !['cancelled', 'refunded'].includes(o.status))
    .reduce((sum, o) => sum + o.total, 0)
  const totalSold = products.reduce((sum, p) => sum + p.soldCount, 0)
  const activeOrders = orders.filter((o) => ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)).length
  const totalViews = products.reduce((sum, p) => sum + p.reviewCount * 15, 0) // approx
  const avgRating = products.length > 0
    ? (products.reduce((sum, p) => sum + p.rating, 0) / products.length).toFixed(1)
    : '0.0'

  const recentOrders = orders.slice(0, 3)

  const stats = [
    { label: 'Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: '💰', color: 'from-[#FFFFFF]/20 to-[#FFFFFF]/5 border-[#FFFFFF]/20' },
    { label: 'Products', value: products.length.toString(), icon: '📦', color: 'from-blue-500/20 to-blue-500/5 border-blue-500/20' },
    { label: 'Total Sold', value: totalSold.toString(), icon: '🛒', color: 'from-[#FFFFFF]/20 to-[#FFFFFF]/5 border-[#FFFFFF]/20' },
    { label: 'Active Orders', value: activeOrders.toString(), icon: '📋', color: 'from-amber-500/20 to-amber-500/5 border-amber-500/20' },
    { label: 'Avg Rating', value: `${avgRating}★`, icon: '⭐', color: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/20' },
    { label: 'Total Orders', value: orders.length.toString(), icon: '📊', color: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20' },
  ]

  return (
    <div className="px-4 space-y-5 pb-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              'rounded-xl p-3.5 bg-gradient-to-br border',
              s.color
            )}
          >
            <span className="text-lg">{s.icon}</span>
            <p className="text-[20px] font-bold text-[#e7e9ea] mt-1">{s.value}</p>
            <p className="text-[11px] text-[#94a3b8]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-[15px] font-bold text-[#e7e9ea] mb-3">Quick Actions</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Add Product', view: 'add-product' as const, icon: '➕', color: 'bg-[#FFFFFF]/10 border-[#FFFFFF]/20 text-[#FFFFFF]' },
            { label: 'View Orders', view: 'business-orders' as const, icon: '📋', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
            { label: 'Inventory', view: '' as const, icon: '📦', color: 'bg-[#FFFFFF]/10 border-[#FFFFFF]/20 text-[#FFFFFF]' },
          ].map((action) => (
            <QuickActionCard key={action.label} {...action} />
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <div>
          <h3 className="text-[15px] font-bold text-[#e7e9ea] mb-3">Recent Orders</h3>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#000000] border border-white/[0.06]">
                <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center text-[18px]">
                  🛍️
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#e7e9ea] truncate">{order.buyerName}</p>
                  <p className="text-[11px] text-[#94a3b8]">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-bold text-[#FFFFFF]">₹{order.total.toLocaleString()}</p>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', STATUS_COLORS[order.status] || '')}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Products */}
      {products.length > 0 && (
        <div>
          <h3 className="text-[15px] font-bold text-[#e7e9ea] mb-3">Top Products</h3>
          <div className="space-y-2">
            {products.sort((a, b) => b.soldCount - a.soldCount).slice(0, 3).map((p) => {
              const images = p.images ? p.images.split(',').map((s) => s.trim()).filter(Boolean) : []
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#000000] border border-white/[0.06]">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#14112a] flex-shrink-0">
                    {images[0] ? (
                      <img src={images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#14112a] flex items-center justify-center text-[#64748b] text-[10px]">No img</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#e7e9ea] line-clamp-1">{p.name}</p>
                    <p className="text-[11px] text-[#94a3b8]">{p.soldCount} sold • ₹{p.price.toLocaleString()}</p>
                  </div>
                  <span className="text-[14px] font-bold text-[#e7e9ea]">₹{(p.soldCount * p.price).toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function QuickActionCard({ label, view, icon, color }: { label: string; view: string; icon: string; color: string }) {
  const navigate = useAppStore((s) => s.navigate)
  const [activeTab, setActiveTab] = useState<DashTab>('overview') // unused but needed to avoid prop passing

  return (
    <button
      onClick={() => {
        if (view === '') {
          // inventory tab
          setActiveTab('inventory')
        } else {
          navigate(view as any)
        }
      }}
      className={cn('flex flex-col items-center gap-2 p-3 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98]', color)}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRODUCTS SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

function ProductsSection({ products, loading, onDelete }: { products: ShopProduct[]; loading: boolean; onDelete: (id: string, name: string) => void }) {
  const navigate = useAppStore((s) => s.navigate)

  return (
    <div className="px-4 pb-6 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-[#e7e9ea]">Your Products</h3>
          <p className="text-[12px] text-[#94a3b8]">{products.length} products listed</p>
        </div>
        <button
          onClick={() => navigate('add-product')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FFFFFF] text-black text-[13px] font-bold shadow-md shadow-[#FFFFFF]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add
        </button>
      </div>

      {/* Products List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[14px] text-[#94a3b8] mb-1">No products yet</p>
          <p className="text-[12px] text-[#64748b]">Start selling by adding your first product</p>
        </div>
      ) : (
        products.map((product) => {
          const images = product.images ? product.images.split(',').map((s) => s.trim()).filter(Boolean) : []
          const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
          return (
            <div key={product.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#000000] border border-white/[0.06]">
              <button
                onClick={() => navigate('product-detail', { id: product.id })}
                className="w-16 h-16 rounded-xl overflow-hidden bg-[#14112a] flex-shrink-0"
              >
                {images[0] ? (
                  <img src={images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#14112a] flex items-center justify-center text-[#64748b] text-[10px]">No img</div>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-semibold text-[#e7e9ea] line-clamp-1 flex-1">{product.name}</p>
                  {product.isFeatured && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 flex-shrink-0">Featured</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[13px] font-bold text-[#FFFFFF]">₹{product.price.toLocaleString()}</span>
                  {hasDiscount && (
                    <span className="text-[11px] text-[#94a3b8] line-through">₹{product.compareAtPrice!.toLocaleString()}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-[#94a3b8]">{product.stock} in stock</span>
                  <span className="text-[11px] text-[#94a3b8]">{product.soldCount} sold</span>
                  <span className="text-[11px] text-[#94a3b8]">{product.category}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  onClick={() => navigate('add-product', { id: product.id })}
                  className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
                >
                  <svg className="w-4 h-4 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => onDelete(product.id, product.name)}
                  className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                >
                  <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   INVENTORY SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

function InventorySection({ products, onUpdateStock }: { products: ShopProduct[]; onUpdateStock: (id: string, stock: number) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stockInput, setStockInput] = useState('')

  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5)
  const outOfStock = products.filter((p) => p.stock === 0)
  const inStock = products.filter((p) => p.stock > 5)

  const handleStartEdit = (product: ShopProduct) => {
    setEditingId(product.id)
    setStockInput(product.stock.toString())
  }

  const handleSaveStock = async (productId: string) => {
    const newStock = parseInt(stockInput, 10)
    if (isNaN(newStock) || newStock < 0) return
    await onUpdateStock(productId, newStock)
    setEditingId(null)
  }

  const StockRow = ({ product }: { product: ShopProduct }) => {
    const images = product.images ? product.images.split(',').map((s) => s.trim()).filter(Boolean) : []
    const isEditing = editingId === product.id

    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#000000] border border-white/[0.06]">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#14112a] flex-shrink-0">
          {images[0] ? (
            <img src={images[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#14112a]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#e7e9ea] line-clamp-1">{product.name}</p>
          <p className="text-[11px] text-[#94a3b8]">SKU: {product.sku || 'N/A'} • {product.category}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value)}
                className="w-16 bg-transparent border border-[#FFFFFF]/40 rounded-lg px-2 py-1.5 text-[13px] text-[#e7e9ea] text-center outline-none focus:border-[#FFFFFF]"
                autoFocus
                min={0}
              />
              <button
                onClick={() => handleSaveStock(product.id)}
                className="w-8 h-8 rounded-lg bg-[#FFFFFF] flex items-center justify-center"
              >
                <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleStartEdit(product)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors',
                product.stock === 0
                  ? 'bg-red-500/15 text-red-400'
                  : product.stock <= 5
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-green-500/15 text-green-400'
              )}
            >
              {product.stock === 0 ? 'Out of stock' : product.stock <= 5 ? `Low: ${product.stock}` : `${product.stock}`}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-6 space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#000000] border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-[20px] font-bold text-[#e7e9ea]">{inStock.length}</p>
          <p className="text-[11px] text-[#94a3b8]">In Stock</p>
        </div>
        <div className="bg-[#000000] border border-amber-500/20 rounded-xl p-3 text-center">
          <p className="text-[20px] font-bold text-amber-400">{lowStock.length}</p>
          <p className="text-[11px] text-[#94a3b8]">Low Stock</p>
        </div>
        <div className="bg-[#000000] border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-[20px] font-bold text-red-400">{outOfStock.length}</p>
          <p className="text-[11px] text-[#94a3b8]">Out of Stock</p>
        </div>
      </div>

      {/* Out of Stock */}
      {outOfStock.length > 0 && (
        <div>
          <h4 className="text-[13px] font-bold text-red-400 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Out of Stock ({outOfStock.length})
          </h4>
          <div className="space-y-2">
            {outOfStock.map((p) => <StockRow key={p.id} product={p} />)}
          </div>
        </div>
      )}

      {/* Low Stock */}
      {lowStock.length > 0 && (
        <div>
          <h4 className="text-[13px] font-bold text-amber-400 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Low Stock ({lowStock.length})
          </h4>
          <div className="space-y-2">
            {lowStock.map((p) => <StockRow key={p.id} product={p} />)}
          </div>
        </div>
      )}

      {/* In Stock */}
      <div>
        <h4 className="text-[13px] font-bold text-green-400 mb-2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          In Stock ({inStock.length})
        </h4>
        <div className="space-y-2">
          {inStock.length === 0 ? (
            <p className="text-[12px] text-[#64748b] text-center py-8">No products in stock</p>
          ) : (
            inStock.map((p) => <StockRow key={p.id} product={p} />)
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ORDERS SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_OPTIONS: { value: ShopOrder['status']; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'text-yellow-400 bg-yellow-500/15' },
  { value: 'confirmed', label: 'Confirmed', color: 'text-blue-400 bg-blue-500/15' },
  { value: 'processing', label: 'Processing', color: 'text-[#FFFFFF] bg-[#FFFFFF]/15' },
  { value: 'shipped', label: 'Shipped', color: 'text-cyan-400 bg-cyan-500/15' },
  { value: 'delivered', label: 'Delivered', color: 'text-green-400 bg-green-500/15' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-red-400 bg-red-500/15' },
]

function OrdersSection({ orders, loading, onStatusChange }: { orders: ShopOrder[]; loading: boolean; onStatusChange: (orderId: string, status: ShopOrder['status']) => void }) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [filter, setFilter] = useState('All')

  const filteredOrders = orders.filter((o) => {
    if (filter === 'All') return true
    if (filter === 'Active') return ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)
    if (filter === 'Completed') return o.status === 'delivered'
    if (filter === 'Cancelled') return ['cancelled', 'refunded'].includes(o.status)
    return true
  })

  return (
    <div className="px-4 pb-6 space-y-4">
      {/* Filter Pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {['All', 'Active', 'Completed', 'Cancelled'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all',
              filter === f ? 'bg-[#FFFFFF] text-black' : 'bg-white/[0.06] text-[#94a3b8]'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Orders */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <p className="text-[14px] text-[#94a3b8]">No orders found</p>
        </div>
      ) : (
        filteredOrders.map((order) => {
          let items: OrderItem[] = []
          try { items = JSON.parse(order.items) } catch { /* ignore */ }
          const isExpanded = expandedOrder === order.id

          return (
            <div key={order.id} className="rounded-xl bg-[#000000] border border-white/[0.06] overflow-hidden">
              <button
                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#94a3b8] font-mono">#{order.id.slice(-8).toUpperCase()}</span>
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', STATUS_COLORS[order.status] || '')}>
                      {order.status}
                    </span>
                  </div>
                  <svg className={cn('w-4 h-4 text-[#94a3b8] transition-transform', isExpanded ? 'rotate-180' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-[13px] text-[#e7e9ea] font-medium">{order.buyerName}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[12px] text-[#94a3b8]">{items.map((i) => i.productName).join(', ')}</p>
                  <p className="text-[15px] font-bold text-[#FFFFFF]">₹{order.total.toLocaleString()}</p>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-white/[0.06] p-4 space-y-4">
                  {/* Items */}
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

                  {/* Status Update */}
                  <div>
                    <h4 className="text-[11px] text-[#94a3b8] uppercase tracking-wider mb-2">Update Status</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => onStatusChange(order.id, opt.value)}
                          disabled={order.status === opt.value}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all',
                            order.status === opt.value
                              ? opt.color
                              : 'bg-white/[0.06] text-[#94a3b8] hover:bg-white/[0.1] disabled:opacity-50'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                      <p className="text-[10px] text-[#94a3b8]">Subtotal</p>
                      <p className="text-[12px] font-semibold text-[#e7e9ea]">₹{order.subtotal.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                      <p className="text-[10px] text-[#94a3b8]">Shipping</p>
                      <p className="text-[12px] font-semibold text-[#e7e9ea]">₹{order.shipping.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                      <p className="text-[10px] text-[#94a3b8]">Date</p>
                      <p className="text-[12px] font-semibold text-[#e7e9ea]">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SETTINGS SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

function SettingsSection() {
  const user = useAppStore((s) => s.user)
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)

  // Initialize with user data
  useEffect(() => {
    if (user) {
      setSettings((prev) => ({
        ...prev,
        storeName: prev.storeName || user.displayName || '',
        storeCover: user.coverImage || '',
      }))
    }
  }, [user])

  const handleSave = async () => {
    if (!user?.id) {
      toast.error('Please sign in to save settings')
      return
    }
    setSaving(true)
    try {
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
      const { db } = await import('@/lib/firebase')
      await setDoc(doc(db, 'stores', user.id), {
        ...settings,
        businessId: user.id,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      toast.success('Store settings saved!')
    } catch (err: any) {
      toast.error('Failed to save: ' + (err?.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const toggleSetting = (key: keyof StoreSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const updateSetting = (key: keyof StoreSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const shippingPartners = [
    { name: 'Delhivery', rate: '₹40 base + ₹15/kg', cod: true, prepaid: true },
    { name: 'BlueDart', rate: '₹60 base + ₹25/kg', cod: true, prepaid: true },
    { name: 'Shiprocket', rate: '₹35 base + ₹12/kg', cod: true, prepaid: true },
    { name: 'DTDC', rate: '₹45 base + ₹18/kg', cod: true, prepaid: false },
    { name: 'Ecom Express', rate: '₹38 base + ₹14/kg', cod: true, prepaid: true },
  ]

  return (
    <div className="px-4 pb-6 space-y-6">
      {/* Store Info */}
      <div className="space-y-4">
        <h3 className="text-[15px] font-bold text-[#e7e9ea]">Store Information</h3>

        {/* Cover Preview */}
        <div className="relative h-28 rounded-xl overflow-hidden bg-[#000000]">
          {settings.storeCover ? (
            <img src={settings.storeCover} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#1a2a1a] to-[#110f1a] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
          <button className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-[#000000]/60 backdrop-blur-sm text-[12px] font-medium text-white hover:bg-[#000000]/80 transition-colors">
            Change Cover
          </button>
        </div>

        {/* Store Name */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8]">Store Name</label>
          <input
            type="text"
            value={settings.storeName}
            onChange={(e) => updateSetting('storeName', e.target.value)}
            placeholder="Your store name"
            className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
          />
        </div>

        {/* Store Description */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8]">Store Description</label>
          <textarea
            value={settings.storeDescription}
            onChange={(e) => updateSetting('storeDescription', e.target.value)}
            placeholder="Tell customers about your store..."
            rows={3}
            className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors resize-none"
          />
        </div>
      </div>

      {/* Shipping Settings */}
      <div className="space-y-4">
        <h3 className="text-[15px] font-bold text-[#e7e9ea]">Shipping Settings</h3>

        {/* Enable Shipping Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#000000] border border-white/[0.06]">
          <div>
            <p className="text-[14px] text-[#e7e9ea]">Enable Shipping</p>
            <p className="text-[12px] text-[#94a3b8]">Enable delivery for physical products</p>
          </div>
          <button
            onClick={() => toggleSetting('shippingEnabled')}
            className={cn(
              'w-11 h-6 rounded-full transition-colors relative',
              settings.shippingEnabled ? 'bg-[#FFFFFF]' : 'bg-white/[0.15]'
            )}
          >
            <div className={cn(
              'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform',
              settings.shippingEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            )} />
          </button>
        </div>

        {/* Free Shipping Above */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8]">Free Shipping Above (₹)</label>
          <input
            type="number"
            value={settings.freeShippingAbove}
            onChange={(e) => updateSetting('freeShippingAbove', e.target.value)}
            placeholder="500"
            className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
          />
          <p className="text-[11px] text-[#64748b]">Orders above this amount get free shipping</p>
        </div>

        {/* Shipping Partners */}
        <div>
          <label className="text-[13px] text-[#94a3b8] mb-2 block">Shipping Partners</label>
          <div className="space-y-2">
            {shippingPartners.map((partner) => (
              <div
                key={partner.name}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer',
                  settings.defaultShippingPartner === partner.name
                    ? 'bg-[#FFFFFF]/10 border-[#FFFFFF]/30'
                    : 'bg-[#000000] border-white/[0.06] hover:border-white/[0.12]'
                )}
                onClick={() => updateSetting('defaultShippingPartner', partner.name)}
              >
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                  settings.defaultShippingPartner === partner.name
                    ? 'border-[#FFFFFF]'
                    : 'border-white/[0.2]'
                )}>
                  {settings.defaultShippingPartner === partner.name && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FFFFFF]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#e7e9ea]">{partner.name}</p>
                  <p className="text-[11px] text-[#94a3b8]">{partner.rate}</p>
                </div>
                <div className="flex gap-1.5">
                  {partner.cod && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">COD</span>
                  )}
                  {partner.prepaid && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">Prepaid</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tax & Returns */}
      <div className="space-y-4">
        <h3 className="text-[15px] font-bold text-[#e7e9ea]">Tax & Returns</h3>

        {/* Tax Rate */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8]">Tax Rate (%)</label>
          <input
            type="number"
            value={settings.taxRate}
            onChange={(e) => updateSetting('taxRate', e.target.value)}
            placeholder="18"
            className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
          />
        </div>

        {/* Currency */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8]">Currency</label>
          <div className="flex gap-2">
            {['INR', 'USD', 'EUR', 'GBP'].map((cur) => (
              <button
                key={cur}
                onClick={() => updateSetting('currency', cur)}
                className={cn(
                  'px-4 py-2 rounded-lg text-[13px] font-semibold transition-all',
                  settings.currency === cur
                    ? 'bg-[#FFFFFF] text-black'
                    : 'bg-white/[0.06] text-[#94a3b8]'
                )}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>

        {/* Return Policy */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8]">Return Policy</label>
          <textarea
            value={settings.returnPolicy}
            onChange={(e) => updateSetting('returnPolicy', e.target.value)}
            placeholder="Describe your return policy..."
            rows={3}
            className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors resize-none"
          />
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] text-black font-bold text-[15px] shadow-lg shadow-[#FFFFFF]/20 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Saving...
          </span>
        ) : 'Save Settings'}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN STORE DASHBOARD VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

export function StoreDashboardView() {
  const navigate = useAppStore((s) => s.navigate)
  const user = useAppStore((s) => s.user)
  const businessId = user?.id || ''

  const [activeTab, setActiveTab] = useState<DashTab>('overview')
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [loading, setLoading] = useState(true)

  const loadStore = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const [prodRes, ordRes] = await Promise.all([
        fetchBusinessProducts(businessId, 50),
        fetchBusinessOrders(businessId),
      ])
      setProducts(prodRes.products)
      setOrders(ordRes)
    } catch (err) {
      console.error('Store dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadStore()
  }, [loadStore])

  const handleDeleteProduct = async (productId: string, name: string) => {
    try {
      await deleteProduct(productId)
      setProducts((prev) => prev.filter((p) => p.id !== productId))
      toast.success(`"${name}" removed`)
    } catch {
      toast.error('Failed to delete product')
    }
  }

  const handleUpdateStock = async (productId: string, stock: number) => {
    try {
      await updateProduct(productId, { stock } as any)
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, stock } : p))
      toast.success('Stock updated')
    } catch {
      toast.error('Failed to update stock')
    }
  }

  const handleStatusChange = async (orderId: string, status: ShopOrder['status']) => {
    try {
      await updateOrderStatus(orderId, status)
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o))
      toast.success(`Order marked as ${status}`)
    } catch {
      toast.error('Failed to update order status')
    }
  }

  const handleBack = () => {
    navigate('profile')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000000]">
        <DashHeader title="Store Dashboard" onBack={handleBack} />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000000]">
      <DashHeader title="Store Dashboard" onBack={handleBack} />

      {/* Store Banner */}
      <div className="relative h-20 bg-gradient-to-r from-[#FFFFFF]/20 via-[#110f1a] to-[#FFFFFF]/10">
        <div className="absolute inset-0 bg-[#000000]/40" />
        <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-black to-transparent" />
        <div className="absolute left-4 bottom-3 flex items-center gap-2 z-10">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-[#FFFFFF] to-[#D1D5DB] flex items-center justify-center flex-shrink-0">
            {user?.profileImage ? (
              <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-black">{(user?.displayName || 'S')[0]}</span>
            )}
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#e7e9ea] inline-flex items-center gap-1">{user?.displayName || 'My Store'}{(user?.isVerified || !!user?.badge) && <VerifiedBadge size={12} badge={user?.badge} />}</p>
            <p className="text-[11px] text-[#94a3b8]">{products.length} products • {orders.length} orders</p>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <SectionTabs active={activeTab} onChange={setActiveTab} />

      {/* Content */}
      {activeTab === 'overview' && <OverviewSection products={products} orders={orders} />}
      {activeTab === 'products' && <ProductsSection products={products} loading={false} onDelete={handleDeleteProduct} />}
      {activeTab === 'inventory' && <InventorySection products={products} onUpdateStock={handleUpdateStock} />}
      {activeTab === 'orders' && <OrdersSection orders={orders} loading={false} onStatusChange={handleStatusChange} />}
      {activeTab === 'settings' && <SettingsSection />}
    </div>
  )
}
