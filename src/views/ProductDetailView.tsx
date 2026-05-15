'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/app'
import { useCartStore } from '@/stores/cart'
import type { ShopProduct, ShopReview } from '@/lib/shop'
import { fetchProductById, fetchProductReviews } from '@/lib/shop'
import { toast } from 'sonner'

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = star <= Math.floor(rating) ? 'full' : star - 0.5 <= rating ? 'half' : 'none'
        return (
          <svg key={star} width={size} height={size} viewBox="0 0 24 24" className="text-amber-400">
            {fill === 'full' && (
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="currentColor" strokeWidth={1} />
            )}
            {fill === 'half' && (
              <>
                <defs>
                  <linearGradient id={`half-${star}`}>
                    <stop offset="50%" stopColor="currentColor" />
                    <stop offset="50%" stopColor="transparent" />
                  </linearGradient>
                </defs>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={`url(#half-${star})`} stroke="currentColor" strokeWidth={1} />
              </>
            )}
            {fill === 'none' && (
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" strokeWidth={1.5} />
            )}
          </svg>
        )
      })}
    </div>
  )
}

export function ProductDetailView() {
  const viewParams = useAppStore((s) => s.viewParams)
  const navigate = useAppStore((s) => s.navigate)
  const productId = viewParams.id || ''

  const [product, setProduct] = useState<ShopProduct | null>(null)
  const [reviews, setReviews] = useState<ShopReview[]>([])
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>({})

  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => {
    if (!productId) return
    const load = async () => {
      setLoading(true)
      try {
        const [prod, revs] = await Promise.all([
          fetchProductById(productId),
          fetchProductReviews(productId),
        ])
        setProduct(prod)
        setReviews(revs)
      } catch {
        setProduct(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [productId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-53px)]">
        <div className="w-8 h-8 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-53px)] px-4">
        <p className="text-[15px] text-[#94a3b8] mb-4">Product not found</p>
        <button onClick={() => navigate('store')} className="px-6 py-2 rounded-full bg-[#FFFFFF] text-black font-bold text-sm">
          Back to Store
        </button>
      </div>
    )
  }

  const images = product.images ? product.images.split(',').map((s) => s.trim()).filter(Boolean) : []
  const mainImage = images[activeImage] || '/placeholder-product.png'
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discount = hasDiscount ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100) : 0

  let variants: { name: string; values: string[] }[] = []
  try { variants = JSON.parse(product.variants || '[]') } catch { /* ignore */ }

  const variantString = Object.entries(selectedVariant).map(([k, v]) => `${k}: ${v}`).join(', ')

  const handleAddToCart = () => {
    if (variants.length > 0 && Object.keys(selectedVariant).length < variants.length) {
      toast.error('Please select all variants')
      return
    }
    addItem({
      productId: product.id,
      businessId: product.businessId,
      productName: product.name,
      price: product.price,
      image: mainImage,
      variant: variantString,
      compareAtPrice: product.compareAtPrice,
    })
    toast.success('Added to cart', { description: product.name, duration: 1500 })
  }

  const handleBuyNow = () => {
    if (variants.length > 0 && Object.keys(selectedVariant).length < variants.length) {
      toast.error('Please select all variants')
      return
    }
    addItem({
      productId: product.id,
      businessId: product.businessId,
      productName: product.name,
      price: product.price,
      image: mainImage,
      variant: variantString,
      compareAtPrice: product.compareAtPrice,
    })
    navigate('cart')
  }

  const starBreakdown = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => Math.round(r.rating) === star).length
    return { star, count, percent: reviews.length > 0 ? (count / reviews.length) * 100 : 0 }
  })

  return (
    <div className="pb-32">
      {/* Image Carousel */}
      <div className="relative">
        <div className="aspect-square bg-[#000000] overflow-hidden">
          <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
        </div>

        {hasDiscount && (
          <div className="absolute top-4 left-4 bg-red-500 text-white text-[13px] font-bold px-3 py-1 rounded-full">
            -{discount}% OFF
          </div>
        )}

        <button
          onClick={() => navigate('store')}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#000000]/50 backdrop-blur-sm flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image dots */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === activeImage ? 'bg-white w-6' : 'bg-white/40'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${i === activeImage ? 'border-[#FFFFFF]' : 'border-transparent opacity-60'}`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Product Info */}
      <div className="px-4">
        {/* Price Row */}
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-[26px] font-bold text-[#e7e9ea]">₹{product.price.toLocaleString()}</span>
          {hasDiscount && (
            <span className="text-[16px] text-[#94a3b8] line-through">₹{product.compareAtPrice!.toLocaleString()}</span>
          )}
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-3">
          <StarDisplay rating={product.rating} size={14} />
          <span className="text-[13px] text-[#94a3b8]">{product.rating.toFixed(1)} ({product.reviewCount} reviews)</span>
          <span className="text-[13px] text-[#94a3b8]">•</span>
          <span className="text-[13px] text-[#94a3b8]">{product.soldCount} sold</span>
        </div>

        {/* Name */}
        <h1 className="text-[18px] font-bold text-[#e7e9ea] leading-tight mb-4">{product.name}</h1>

        {/* Business Card */}
        <button
          onClick={() => navigate('storefront', { id: product.businessId })}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4 hover:bg-white/[0.06] transition-colors"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#000000] flex-shrink-0">
            {product.businessImage ? (
              <img src={product.businessImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#FFFFFF] to-[#D1D5DB] flex items-center justify-center">
                <span className="text-sm font-bold text-black">{product.businessName[0]?.toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-[14px] font-semibold text-[#e7e9ea]">{product.businessName}</p>
            <p className="text-[12px] text-[#94a3b8]">Visit Store →</p>
          </div>
          <svg className="w-5 h-5 text-[#94a3b8] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Description */}
        <div className="mb-4">
          <h3 className="text-[14px] font-semibold text-[#e7e9ea] mb-2">Description</h3>
          <p className="text-[14px] text-[#94a3b8] leading-relaxed">{product.description}</p>
        </div>

        {/* Category & Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 rounded-full bg-[#FFFFFF]/10 text-[#FFFFFF] text-[12px] font-medium">{product.category}</span>
          {product.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full bg-white/[0.06] text-[#94a3b8] text-[12px]">#{tag}</span>
          ))}
        </div>

        {/* Variants */}
        {variants.length > 0 && variants.map((variant) => (
          <div key={variant.name} className="mb-4">
            <h3 className="text-[14px] font-semibold text-[#e7e9ea] mb-2">
              {variant.name}: <span className="text-[#FFFFFF]">{selectedVariant[variant.name] || 'Select'}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {variant.values.map((value) => (
                <button
                  key={value}
                  onClick={() => setSelectedVariant((prev) => ({ ...prev, [variant.name]: value }))}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                    selectedVariant[variant.name] === value
                      ? 'bg-[#FFFFFF] text-black'
                      : 'bg-white/[0.06] text-[#94a3b8] hover:bg-white/[0.1]'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Quantity */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4">
          <span className="text-[14px] font-semibold text-[#e7e9ea]">Quantity</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 12h14" />
              </svg>
            </button>
            <span className="text-[16px] font-bold text-[#e7e9ea] w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => Math.min(product.stock > 0 ? product.stock : 99, q + 1))}
              className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stock */}
        <p className="text-[12px] text-[#94a3b8] mb-6">
          {product.stock > 0 ? `${product.stock} in stock` : product.isDigital ? 'Digital product' : 'Out of stock'}
          {product.sku && ` • SKU: ${product.sku}`}
        </p>

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <div className="border-t border-white/[0.06] pt-5 mb-4">
            <h3 className="text-[15px] font-bold text-[#e7e9ea] mb-4">Reviews ({reviews.length})</h3>

            {/* Star Breakdown */}
            <div className="flex gap-6 mb-5">
              <div className="text-center">
                <p className="text-[36px] font-bold text-[#e7e9ea]">{product.rating.toFixed(1)}</p>
                <StarDisplay rating={product.rating} size={14} />
                <p className="text-[11px] text-[#94a3b8] mt-1">{product.reviewCount} reviews</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {starBreakdown.map(({ star, count, percent }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[11px] text-[#94a3b8] w-3">{star}</span>
                    <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="text-[11px] text-[#94a3b8] w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Review List */}
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {reviews.map((review) => (
                <div key={review.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-[#000000]">
                      {review.buyerImage ? (
                        <img src={review.buyerImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#000000] flex items-center justify-center text-[10px] font-bold text-[#e7e9ea]">
                          {review.buyerName[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-[#e7e9ea]">{review.buyerName}</p>
                      <p className="text-[11px] text-[#94a3b8]">{new Date(review.createdAt).toLocaleDateString()}</p>
                    </div>
                    <StarDisplay rating={review.rating} size={12} />
                  </div>
                  <p className="text-[13px] text-[#94a3b8] leading-relaxed">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-[50px] left-0 right-0 z-20 bg-[#000000]/90 backdrop-blur-xl border-t border-white/[0.08] p-4 safe-area-bottom">
        <div className="flex gap-3">
          <button
            onClick={handleAddToCart}
            className="flex-1 py-3.5 rounded-full border border-[#FFFFFF] text-[#FFFFFF] font-bold text-[15px] hover:bg-[#FFFFFF]/10 transition-colors active:scale-[0.98]"
          >
            Add to Cart
          </button>
          <button
            onClick={handleBuyNow}
            className="flex-1 py-3.5 rounded-full bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] text-black font-bold text-[15px] shadow-lg shadow-[#FFFFFF]/20 hover:shadow-xl transition-all active:scale-[0.98]"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  )
}
