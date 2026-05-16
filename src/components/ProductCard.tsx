'use client'

import { useCartStore } from '@/stores/cart'
import { useAppStore } from '@/stores/app'
import type { ShopProduct } from '@/lib/shop'
import { toast } from 'sonner'

function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className="text-amber-400"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= Math.round(rating) ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={2}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  )
}

export function ProductCard({ product }: { product: ShopProduct }) {
  const addItem = useCartStore((s) => s.addItem)
  const navigate = useAppStore((s) => s.navigate)

  const images = product.images ? product.images.split(',').map((s) => s.trim()).filter(Boolean) : []
  const mainImage = images[0] || '/placeholder-product.png'
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discount = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    addItem({
      productId: product.id,
      businessId: product.businessId,
      productName: product.name,
      price: product.price,
      image: mainImage,
      variant: '',
      compareAtPrice: product.compareAtPrice,
    })
    toast.success('Added to cart', {
      description: product.name,
      duration: 1500,
    })
  }

  return (
    <div
      onClick={() => navigate('product-detail', { id: product.id })}
      className="rounded-xl bg-[#000000] border border-white/[0.06] overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-1 cursor-pointer group active:scale-[0.98]"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-[#14112a]">
        <img
          src={mainImage}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />

        {/* Discount badge */}
        {hasDiscount && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
            -{discount}%
          </div>
        )}

        {/* Featured badge */}
        {product.isFeatured && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Featured
          </div>
        )}

        {/* Sold count */}
        {product.soldCount > 0 && (
          <div className="absolute bottom-2 left-2 bg-[#000000]/70 backdrop-blur-sm text-[10px] text-[#e7e9ea] px-2 py-0.5 rounded-full">
            {product.soldCount} sold
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-[13px] font-semibold text-[#e7e9ea] line-clamp-2 leading-tight mb-1.5 min-h-[2.5em]">
          {product.name}
        </p>

        {/* Business */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate('storefront', { id: product.businessId })
          }}
          className="flex items-center gap-1.5 mb-2 group/biz"
        >
          <div className="w-4 h-4 rounded-full overflow-hidden bg-[#000000] flex-shrink-0">
            {product.businessImage ? (
              <img src={product.businessImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#000000]" />
            )}
          </div>
          <span className="text-[11px] text-[#94a3b8] group-hover/biz:text-[#FFFFFF] transition-colors truncate">
            {product.businessName}
          </span>
        </button>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-[16px] font-bold text-[#e7e9ea]">
            ₹{product.price.toLocaleString()}
          </span>
          {hasDiscount && (
            <span className="text-[12px] text-[#94a3b8] line-through">
              ₹{product.compareAtPrice!.toLocaleString()}
            </span>
          )}
        </div>

        {/* Rating & Add to Cart */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <StarRating rating={product.rating} />
            <span className="text-[11px] text-[#94a3b8]">({product.reviewCount})</span>
          </div>

          <button
            onClick={handleAddToCart}
            className="w-8 h-8 rounded-full bg-[#FFFFFF] flex items-center justify-center hover:bg-[#D1D5DB] active:scale-90 transition-all shadow-md shadow-[#FFFFFF]/20"
            aria-label="Add to cart"
          >
            <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
