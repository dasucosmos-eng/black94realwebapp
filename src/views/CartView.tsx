'use client'

import { useAppStore } from '@/stores/app'
import { useCartStore } from '@/stores/cart'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function CartView() {
  const navigate = useAppStore((s) => s.navigate)
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const shipping = subtotal > 0 ? (subtotal >= 999 ? 0 : 99) : 0
  const total = subtotal + shipping

  const handleQuantityChange = (productId: string, delta: number) => {
    const item = items.find((i) => i.productId === productId)
    if (!item) return
    const newQty = item.quantity + delta
    if (newQty < 1) {
      removeItem(productId)
      toast.success('Item removed')
    } else {
      updateQuantity(productId, newQty)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-53px-50px)] px-4">
        <div className="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
          </svg>
        </div>
        <h2 className="text-[18px] font-bold text-[#e7e9ea] mb-2">Your cart is empty</h2>
        <p className="text-[14px] text-[#94a3b8] mb-6 text-center">Discover amazing products in our store</p>
        <button
          onClick={() => navigate('store')}
          className="px-8 py-3 rounded-full bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] text-black font-bold text-[15px] shadow-lg shadow-[#FFFFFF]/20"
        >
          Browse Store
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-53px-50px)] pb-44">
      {/* Header area */}
      <div className="px-4 pt-2 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-[#e7e9ea]">Shopping Cart</h2>
          <p className="text-[13px] text-[#94a3b8]">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => {
            clearCart()
            toast.success('Cart cleared')
          }}
          className="text-[13px] text-red-400 hover:text-red-300 transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Cart Items */}
      <div className="px-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.productId + item.variant}
            className="flex gap-3 p-3 rounded-xl bg-[#000000] border border-white/[0.06] group"
          >
            {/* Image */}
            <div
              className="w-20 h-20 rounded-lg overflow-hidden bg-[#14112a] flex-shrink-0 cursor-pointer"
              onClick={() => navigate('product-detail', { id: item.productId })}
            >
              <img src={item.image || '/placeholder-product.png'} alt={item.productName} className="w-full h-full object-cover" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3
                className="text-[14px] font-semibold text-[#e7e9ea] line-clamp-1 cursor-pointer hover:text-[#FFFFFF] transition-colors"
                onClick={() => navigate('product-detail', { id: item.productId })}
              >
                {item.productName}
              </h3>
              {item.variant && (
                <p className="text-[12px] text-[#94a3b8] mt-0.5">{item.variant}</p>
              )}

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[16px] font-bold text-[#e7e9ea]">₹{(item.price * item.quantity).toLocaleString()}</span>
                  {item.compareAtPrice && (
                    <span className="text-[11px] text-[#94a3b8] line-through">₹{(item.compareAtPrice * item.quantity).toLocaleString()}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleQuantityChange(item.productId, -1)}
                    className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                  <span className="text-[14px] font-bold text-[#e7e9ea] w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(item.productId, 1)}
                    className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Delete */}
            <button
              onClick={() => {
                removeItem(item.productId)
                toast.success('Item removed')
              }}
              className="self-start w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
            >
              <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Free shipping banner */}
      {subtotal < 999 && subtotal > 0 && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-gradient-to-r from-[#FFFFFF]/10 to-transparent border border-[#FFFFFF]/20">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#FFFFFF] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
            <p className="text-[13px] text-[#FFFFFF]">
              Add ₹{(999 - subtotal).toLocaleString()} more for free shipping
            </p>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] transition-all" style={{ width: `${Math.min(100, (subtotal / 999) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Order Summary */}
      <div className="mx-4 mt-5 p-4 rounded-xl bg-[#000000] border border-white/[0.06] space-y-3">
        <h3 className="text-[14px] font-bold text-[#e7e9ea]">Order Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[13px] text-[#94a3b8]">Subtotal</span>
            <span className="text-[13px] text-[#e7e9ea]">₹{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[13px] text-[#94a3b8]">Shipping</span>
            <span className={cn('text-[13px]', shipping === 0 ? 'text-[#FFFFFF]' : 'text-[#e7e9ea]')}>
              {shipping === 0 ? 'FREE' : `₹${shipping}`}
            </span>
          </div>
          <div className="border-t border-white/[0.06] pt-2 flex justify-between">
            <span className="text-[15px] font-bold text-[#e7e9ea]">Total</span>
            <span className="text-[18px] font-bold text-[#FFFFFF]">₹{total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Checkout Button */}
      <div className="fixed bottom-[50px] left-0 right-0 z-20 bg-[#000000]/90 backdrop-blur-xl border-t border-white/[0.08] p-4 safe-area-bottom">
        <button
          onClick={() => navigate('checkout')}
          className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] text-black font-bold text-[15px] shadow-lg shadow-[#FFFFFF]/20 hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span>Checkout</span>
          <span className="text-[13px] bg-[#000000]/20 px-2 py-0.5 rounded-full">₹{total.toLocaleString()}</span>
        </button>
      </div>
    </div>
  )
}
