'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/app'
import type { ShopProduct } from '@/lib/shop'
import { fetchProductById, createProduct, updateProduct } from '@/lib/shop'
import { toast } from 'sonner'

const CATEGORIES = ['Electronics', 'Fashion', 'Food', 'Services', 'Digital', 'Beauty', 'Home', 'Sports', 'Books', 'Art', 'Other']

interface FormData {
  name: string
  description: string
  price: string
  compareAtPrice: string
  category: string
  tags: string
  images: string
  stock: string
  sku: string
  variants: string
  isDigital: boolean
  isFeatured: boolean
}

export function AddProductView() {
  const viewParams = useAppStore((s) => s.viewParams)
  const navigate = useAppStore((s) => s.navigate)
  const user = useAppStore((s) => s.user)
  const productId = viewParams.id || ''
  const isEditing = !!productId

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    price: '',
    compareAtPrice: '',
    category: 'Electronics',
    tags: '',
    images: '',
    stock: '10',
    sku: '',
    variants: '[]',
    isDigital: false,
    isFeatured: false,
  })

  useEffect(() => {
    if (!productId) return
    const loadProduct = async () => {
      setLoading(true)
      try {
        const product = await fetchProductById(productId)
        if (product) {
          setForm({
            name: product.name,
            description: product.description,
            price: product.price.toString(),
            compareAtPrice: product.compareAtPrice?.toString() || '',
            category: product.category,
            tags: product.tags.join(', '),
            images: product.images,
            stock: product.stock.toString(),
            sku: product.sku,
            variants: product.variants,
            isDigital: product.isDigital,
            isFeatured: product.isFeatured,
          })
        }
      } catch {
        toast.error('Failed to load product')
      } finally {
        setLoading(false)
      }
    }
    loadProduct()
  }, [productId])

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    if (!form.price || Number(form.price) <= 0) { toast.error('Valid price is required'); return }
    if (!user) return

    setSaving(true)
    try {
      const productData = {
        businessId: user.id,
        businessName: user.displayName || user.username,
        businessImage: user.profileImage,
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
        category: form.category,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        images: form.images,
        stock: Number(form.stock) || 0,
        sku: form.sku.trim(),
        variants: form.variants,
        isDigital: form.isDigital,
        isFeatured: form.isFeatured,
        isActive: true,
      }

      if (isEditing) {
        await updateProduct(productId, productData)
        toast.success('Product updated!')
      } else {
        await createProduct(productData)
        toast.success('Product created!')
      }
      navigate('my-store')
    } catch (err) {
      console.error('Save error:', err)
      toast.error(isEditing ? 'Failed to update product' : 'Failed to create product')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-53px)]">
        <div className="w-8 h-8 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-53px-50px)] pb-24">
      <div className="px-4 pt-2">
        <h2 className="text-[18px] font-bold text-[#e7e9ea] mb-1">
          {isEditing ? 'Edit Product' : 'Add New Product'}
        </h2>
        <p className="text-[13px] text-[#94a3b8] mb-5">
          {isEditing ? 'Update your product details' : 'List a new product on Black94 Market'}
        </p>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[13px] text-[#94a3b8]">Product Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Wireless Headphones Pro"
              className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[13px] text-[#94a3b8]">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe your product..."
              rows={4}
              className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors resize-none"
            />
          </div>

          {/* Price Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] text-[#94a3b8]">Price (₹) *</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0"
                className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] text-[#94a3b8]">Compare at Price</label>
              <input
                type="number"
                value={form.compareAtPrice}
                onChange={(e) => setForm((f) => ({ ...f, compareAtPrice: e.target.value }))}
                placeholder="Original price"
                className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-[13px] text-[#94a3b8]">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                    form.category === cat
                      ? 'bg-[#FFFFFF] text-black'
                      : 'bg-white/[0.06] text-[#94a3b8] hover:bg-white/[0.1]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-[13px] text-[#94a3b8]">Tags (comma separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="e.g. wireless, audio, premium"
              className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
            />
          </div>

          {/* Images */}
          <div className="space-y-1.5">
            <label className="text-[13px] text-[#94a3b8]">Image URLs (comma separated)</label>
            <textarea
              value={form.images}
              onChange={(e) => setForm((f) => ({ ...f, images: e.target.value }))}
              placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
              rows={2}
              className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors resize-none"
            />
            {form.images && (
              <div className="flex gap-2 overflow-x-auto pt-1">
                {form.images.split(',').map((url, i) => {
                  const trimmed = url.trim()
                  if (!trimmed) return null
                  return (
                    <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-[#14112a] flex-shrink-0">
                      <img src={trimmed} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Stock & SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] text-[#94a3b8]">Stock</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                placeholder="0"
                className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] text-[#94a3b8]">SKU</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                placeholder="PROD-001"
                className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
              />
            </div>
          </div>

          {/* Variants */}
          <div className="space-y-1.5">
            <label className="text-[13px] text-[#94a3b8]">Variants (JSON)</label>
            <textarea
              value={form.variants}
              onChange={(e) => setForm((f) => ({ ...f, variants: e.target.value }))}
              placeholder='[{"name":"Size","values":["S","M","L"]}]'
              rows={3}
              className="w-full bg-transparent border border-white/[0.08] rounded-lg px-4 py-2.5 text-[14px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors resize-none font-mono"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#000000] border border-white/[0.06]">
              <div>
                <p className="text-[14px] text-[#e7e9ea]">Digital Product</p>
                <p className="text-[12px] text-[#94a3b8]">No shipping required</p>
              </div>
              <button
                onClick={() => setForm((f) => ({ ...f, isDigital: !f.isDigital }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.isDigital ? 'bg-[#FFFFFF]' : 'bg-white/[0.15]'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${form.isDigital ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#000000] border border-white/[0.06]">
              <div>
                <p className="text-[14px] text-[#e7e9ea]">Featured Product</p>
                <p className="text-[12px] text-[#94a3b8]">Show in featured section</p>
              </div>
              <button
                onClick={() => setForm((f) => ({ ...f, isFeatured: !f.isFeatured }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.isFeatured ? 'bg-[#FFFFFF]' : 'bg-white/[0.15]'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${form.isFeatured ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-[#000000]/95 backdrop-blur-xl border-t border-white/[0.08] p-4 safe-area-bottom">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FFFFFF] to-[#D1D5DB] text-black font-bold text-[15px] shadow-lg shadow-[#FFFFFF]/20 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              {isEditing ? 'Updating...' : 'Creating...'}
            </span>
          ) : (
            isEditing ? 'Update Product' : 'Create Product'
          )}
        </button>
      </div>
    </div>
  )
}
