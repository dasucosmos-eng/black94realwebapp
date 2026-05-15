import { create } from 'zustand'

export interface CartItem {
  productId: string
  businessId: string
  productName: string
  price: number
  quantity: number
  image: string
  variant: string
  compareAtPrice?: number
}

interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, qty: number) => void
  clearCart: () => void
  totalItems: number
  subtotal: number
}

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem('black94_cart')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveCart(items: CartItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('black94_cart', JSON.stringify(items))
  } catch {
    // ignore
  }
}

export const useCartStore = create<CartState>((set, get) => ({
  items: loadCart(),

  addItem: (item) => {
    const items = [...get().items]
    const idx = items.findIndex((i) => i.productId === item.productId && i.variant === item.variant)
    if (idx >= 0) {
      items[idx] = { ...items[idx], quantity: items[idx].quantity + 1 }
    } else {
      items.push({ ...item, quantity: 1 })
    }
    saveCart(items)
    set({ items })
  },

  removeItem: (productId) => {
    const items = get().items.filter((i) => i.productId !== productId)
    saveCart(items)
    set({ items })
  },

  updateQuantity: (productId, qty) => {
    if (qty < 1) return
    const items = get().items.map((i) =>
      i.productId === productId ? { ...i, quantity: qty } : i
    )
    saveCart(items)
    set({ items })
  },

  clearCart: () => {
    saveCart([])
    set({ items: [] })
  },

  get totalItems() {
    return get().items.reduce((sum, i) => sum + i.quantity, 0)
  },

  get subtotal() {
    return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  },
}))
