'use client'

import { useState } from 'react'
import { useAppStore } from '@/stores/app'
import { useCartStore } from '@/stores/cart'
import type { ShippingPartner } from '@/lib/shop'
import { fetchShippingPartners, calculateShipping, createOrder } from '@/lib/shop'
import { toast } from 'sonner'

interface AddressForm {
  name: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  pincode: string
}

const STEPS = ['Address', 'Shipping', 'Confirm']

export function CheckoutView() {
  const navigate = useAppStore((s) => s.navigate)
  const user = useAppStore((s) => s.user)
  const items = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clearCart)

  const [step, setStep] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [address, setAddress] = useState<AddressForm>({
    name: user?.displayName || '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  })
  const [partners, setPartners] = useState<ShippingPartner[]>([])
  const [selectedPartner, setSelectedPartner] = useState<ShippingPartner | null>(null)
  const [shippingCost, setShippingCost] = useState(99)

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const tax = Math.round(subtotal * 0.05)
  const total = subtotal + shippingCost + tax

  const loadShipping = async () => {
    try {
      const result = await fetchShippingPartners()
      if (result.length > 0) {
        setPartners(result)
        setSelectedPartner(result[0])
        setShippingCost(calculateShipping(result[0], 0.5, address.pincode))
      }
    } catch {
      setPartners([])
      toast.error('Could not load shipping partners. Please try again.')
    }
  }

  const validateAddress = (): boolean => {
    if (!address.name.trim()) { toast.error('Please enter your name'); return false }
    if (!address.phone.trim() || address.phone.length < 10) { toast.error('Please enter a valid phone number'); return false }
    if (!address.line1.trim()) { toast.error('Please enter your address'); return false }
    if (!address.city.trim()) { toast.error('Please enter your city'); return false }
    if (!address.state.trim()) { toast.error('Please enter your state'); return false }
    if (!address.pincode.trim() || address.pincode.length < 6) { toast.error('Please enter a valid pincode'); return false }
    return true
  }

  const handleNext = () => {
    if (step === 0) {
      if (!validateAddress()) return
      loadShipping()
      setStep(1)
    } else if (step === 1) {
      if (!selectedPartner) { toast.error('Please select a shipping method'); return }
      setStep(2)
    }
  }

  const handlePlaceOrder = async () => {
    if (!user) return
    setPlacing(true)
    try {
      await createOrder({
        buyerId: user.id,
        buyerName: address.name,
        buyerEmail: user.email,
        businessId: items[0]?.businessId || '',
        businessName: items[0]?.productName || 'Black94 Market',
        items: JSON.stringify(items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          price: i.price,
          quantity: i.quantity,
          image: i.image,
          variant: i.variant,
        }))),
        subtotal,
        shipping: shippingCost,
        tax,
        total,
        shippingAddress: JSON.stringify(address),
        trackingNumber: '',
        trackingPartner: selectedPartner?.name || '',
        notes: '',
      })
      clearCart()
      toast.success('Order placed successfully!')
      navigate('order-tracking')
    } catch (err) {
      console.error('Order error:', err)
      toast.error('Failed to place order. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-53px)] pb-8">
      {/* Step Indicator */}
      <div className="px-4 pt-4 pb-5">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all ${
                i <= step ? 'bg-[#FFFFFF] text-black' : 'bg-white/[0.06] text-[#94a3b8]'
              }`}>
                {i < step ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : i + 1}
              </div>
              <span className={`text-[13px] font-medium hidden sm:inline ${i <= step ? 'text-[#e7e9ea]' : 'text-[#94a3b8]'}`}>
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full ${i < step ? 'bg-[#FFFFFF]' : 'bg-white/[0.06]'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="px-4">
        {/* Step 0: Address */}
        {step === 0 && (
          <div className="space-y-3">
            <h2 className="text-[16px] font-bold text-[#e7e9ea] mb-4">Shipping Address</h2>
            {[
              { key: 'name' as const, label: 'Full Name', placeholder: 'Your name', type: 'text' },
              { key: 'phone' as const, label: 'Phone Number', placeholder: '10-digit number', type: 'tel' },
              { key: 'line1' as const, label: 'Address Line 1', placeholder: 'House no, Street', type: 'text' },
              { key: 'line2' as const, label: 'Address Line 2', placeholder: 'Landmark (optional)', type: 'text' },
              { key: 'city' as const, label: 'City', placeholder: 'Your city', type: 'text' },
              { key: 'state' as const, label: 'State', placeholder: 'Your state', type: 'text' },
              { key: 'pincode' as const, label: 'Pincode', placeholder: '6-digit pincode', type: 'text' },
            ].map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-[13px] text-[#94a3b8]">{field.label}</label>
                <input
                  type={field.type}
                  value={address[field.key]}
                  onChange={(e) => setAddress((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
                />
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Shipping */}
        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-[16px] font-bold text-[#e7e9ea] mb-4">Shipping Method</h2>
            {partners.map((partner) => {
              const cost = calculateShipping(partner, 0.5, address.pincode)
              const isSelected = selectedPartner?.id === partner.id
              return (
                <button
                  key={partner.id}
                  onClick={() => {
                    setSelectedPartner(partner)
                    setShippingCost(cost)
                  }}
                  className={`w-full p-4 rounded-xl border transition-all text-left ${
                    isSelected
                      ? 'border-[#FFFFFF] bg-[#FFFFFF]/5'
                      : 'border-white/[0.06] bg-[#000000] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-[#FFFFFF]' : 'border-[#64748b]'
                      }`}>
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#FFFFFF]" />}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[#e7e9ea]">{partner.name}</p>
                        <p className="text-[12px] text-[#94a3b8]">
                          {partner.estimatedDays} days
                          {partner.supportsCOD && ' • COD available'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[15px] font-bold text-[#FFFFFF]">
                      {cost === 0 ? 'FREE' : `₹${cost}`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-[16px] font-bold text-[#e7e9ea] mb-4">Order Confirmation</h2>

            {/* Address Summary */}
            <div className="p-4 rounded-xl bg-[#000000] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-semibold text-[#94a3b8] uppercase tracking-wider">Shipping To</h3>
                <button onClick={() => setStep(0)} className="text-[12px] text-[#FFFFFF]">Edit</button>
              </div>
              <p className="text-[14px] text-[#e7e9ea] font-medium">{address.name}</p>
              <p className="text-[13px] text-[#94a3b8]">{address.line1}</p>
              {address.line2 && <p className="text-[13px] text-[#94a3b8]">{address.line2}</p>}
              <p className="text-[13px] text-[#94a3b8]">{address.city}, {address.state} - {address.pincode}</p>
              <p className="text-[13px] text-[#94a3b8]">{address.phone}</p>
            </div>

            {/* Shipping Summary */}
            <div className="p-4 rounded-xl bg-[#000000] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-semibold text-[#94a3b8] uppercase tracking-wider">Shipping</h3>
                <button onClick={() => setStep(1)} className="text-[12px] text-[#FFFFFF]">Edit</button>
              </div>
              <p className="text-[14px] text-[#e7e9ea] font-medium">{selectedPartner?.name}</p>
              <p className="text-[13px] text-[#94a3b8]">Estimated: {selectedPartner?.estimatedDays} days</p>
            </div>

            {/* Items */}
            <div className="p-4 rounded-xl bg-[#000000] border border-white/[0.06]">
              <h3 className="text-[13px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">Items ({items.length})</h3>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3">
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
            </div>

            {/* Totals */}
            <div className="p-4 rounded-xl bg-[#000000] border border-white/[0.06] space-y-2">
              <div className="flex justify-between">
                <span className="text-[13px] text-[#94a3b8]">Subtotal</span>
                <span className="text-[13px] text-[#e7e9ea]">₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-[#94a3b8]">Shipping</span>
                <span className="text-[13px] text-[#e7e9ea]">{shippingCost === 0 ? 'FREE' : `₹${shippingCost}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-[#94a3b8]">Tax (5%)</span>
                <span className="text-[13px] text-[#e7e9ea]">₹{tax.toLocaleString()}</span>
              </div>
              <div className="border-t border-white/[0.06] pt-2 flex justify-between">
                <span className="text-[16px] font-bold text-[#e7e9ea]">Total</span>
                <span className="text-[20px] font-bold text-[#FFFFFF]">₹{total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-[#000000]/95 backdrop-blur-xl border-t border-white/[0.08] p-4 safe-area-bottom">
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3.5 rounded-full border border-white/[0.12] text-[#e7e9ea] font-bold text-[15px] hover:bg-white/[0.06] transition-colors"
            >
              Back
            </button>
          )}
          {step < 2 ? (
            <button
              onClick={handleNext}
              className="flex-1 py-3.5 rounded-full bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] text-black font-bold text-[15px] shadow-lg shadow-[#FFFFFF]/20 active:scale-[0.98] transition-all"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="flex-1 py-3.5 rounded-full bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] text-black font-bold text-[15px] shadow-lg shadow-[#FFFFFF]/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {placing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Placing Order...
                </span>
              ) : (
                `Pay ₹${total.toLocaleString()}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
