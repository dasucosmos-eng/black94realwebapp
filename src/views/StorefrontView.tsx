'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/app'
import type { ShopProduct } from '@/lib/shop'
import { fetchBusinessProducts } from '@/lib/shop'
import { ProductCard } from '@/components/ProductCard'
import type { DocumentSnapshot, DocumentData } from 'firebase/firestore'

export function StorefrontView() {
  const viewParams = useAppStore((s) => s.viewParams)
  const navigate = useAppStore((s) => s.navigate)
  const businessId = viewParams.id || ''

  const [products, setProducts] = useState<ShopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const lastDocRef = useRef<DocumentSnapshot<DocumentData> | null>(null)

  const businessName = products.length > 0 ? products[0].businessName : 'Store'
  const businessImage = products.length > 0 ? products[0].businessImage : ''

  const loadProducts = async () => {
    setLoading(true)
    try {
      const res = await fetchBusinessProducts(businessId, 20)
      setProducts(res.products)
      lastDocRef.current = res.lastDoc
      setHasMore(res.products.length >= 20)
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (businessId) loadProducts()
  }, [businessId])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const res = await fetchBusinessProducts(businessId, 20, lastDocRef.current || undefined)
      setProducts((prev) => [...prev, ...res.products])
      lastDocRef.current = res.lastDoc
      setHasMore(res.products.length >= 20)
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  const totalSold = products.reduce((sum, p) => sum + p.soldCount, 0)
  const avgRating = products.length > 0
    ? (products.reduce((sum, p) => sum + p.rating, 0) / products.length).toFixed(1)
    : '0.0'

  return (
    <div className="min-h-[calc(100vh-53px-50px)] pb-24">
      {/* Cover */}
      <div className="relative h-32 bg-gradient-to-br from-[#FFFFFF]/30 via-[#110f1a] to-[#1a1a2e]">
        <div className="absolute inset-0 bg-[#000000]/30" />
        <button
          onClick={() => navigate('store')}
          className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-[#000000]/50 backdrop-blur-sm flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Business Info */}
      <div className="px-4 -mt-10 relative z-10">
        <div className="flex items-end gap-3">
          <div className="w-20 h-20 rounded-2xl bg-[#000000] border-4 border-black overflow-hidden flex-shrink-0">
            {businessImage ? (
              <img src={businessImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#FFFFFF] to-[#D1D5DB] flex items-center justify-center">
                <span className="text-2xl font-bold text-black">{businessName[0]?.toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="pb-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[18px] font-bold text-[#e7e9ea]">{businessName}</h1>
              <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-[13px] text-[#94a3b8]">{products.length} products</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-[#000000] border border-white/[0.06] rounded-xl p-3 text-center">
            <p className="text-[18px] font-bold text-[#e7e9ea]">{products.length}</p>
            <p className="text-[11px] text-[#94a3b8]">Products</p>
          </div>
          <div className="bg-[#000000] border border-white/[0.06] rounded-xl p-3 text-center">
            <p className="text-[18px] font-bold text-[#FFFFFF]">{totalSold}</p>
            <p className="text-[11px] text-[#94a3b8]">Sales</p>
          </div>
          <div className="bg-[#000000] border border-white/[0.06] rounded-xl p-3 text-center">
            <p className="text-[18px] font-bold text-amber-400">{avgRating}★</p>
            <p className="text-[11px] text-[#94a3b8]">Rating</p>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="mt-6 px-4">
        <h2 className="text-[15px] font-bold text-[#e7e9ea] mb-3">All Products</h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin mb-3" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[15px] text-[#94a3b8]">No products yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {loadingMore && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
          </div>
        )}

        {hasMore && !loading && (
          <button
            onClick={loadMore}
            className="w-full py-3 mt-4 rounded-full bg-white/[0.06] text-[14px] font-semibold text-[#FFFFFF] hover:bg-white/[0.1] transition-colors"
          >
            Load More
          </button>
        )}
      </div>
    </div>
  )
}
