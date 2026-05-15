import {
  db,
} from './firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getDocs,
  serverTimestamp,
  DocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ShopProduct {
  id: string
  businessId: string
  businessName: string
  businessImage: string
  name: string
  description: string
  price: number
  compareAtPrice?: number
  category: string
  tags: string[]
  images: string
  stock: number
  sku: string
  variants: string
  isDigital: boolean
  isFeatured: boolean
  isActive: boolean
  rating: number
  reviewCount: number
  soldCount: number
  createdAt: string
  updatedAt: string
}

export interface ShopOrder {
  id: string
  buyerId: string
  buyerName: string
  buyerEmail: string
  businessId: string
  businessName: string
  items: string // JSON
  subtotal: number
  shipping: number
  tax: number
  total: number
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
  shippingAddress: string // JSON
  trackingNumber: string
  trackingPartner: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  productId: string
  productName: string
  price: number
  quantity: number
  image: string
  variant: string
}

export interface ShopReview {
  id: string
  productId: string
  buyerId: string
  buyerName: string
  buyerImage: string
  rating: number
  comment: string
  createdAt: string
}

export interface ShippingPartner {
  id: string
  name: string
  logo: string
  isActive: boolean
  baseRate: number
  perKgRate: number
  estimatedDays: string
  supportsCOD: boolean
  supportsPrepaid: boolean
}

// ── Helper ──────────────────────────────────────────────────────────────────

function tsToISO(value: unknown): string {
  if (value && typeof value === 'object' && 'seconds' in value) {
    const ts = value as { seconds: number; nanoseconds: number };
    return new Date(ts.seconds * 1000 + ts.nanoseconds / 1_000_000).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function docToProduct(docSnap: DocumentSnapshot<DocumentData>): ShopProduct {
  const d = docSnap.data()!;
  return {
    id: docSnap.id,
    businessId: d.businessId ?? '',
    businessName: d.businessName ?? '',
    businessImage: d.businessImage ?? '',
    name: d.name ?? '',
    description: d.description ?? '',
    price: d.price ?? 0,
    compareAtPrice: d.compareAtPrice,
    category: d.category ?? '',
    tags: Array.isArray(d.tags) ? d.tags : [],
    images: d.images ?? '',
    stock: d.stock ?? 0,
    sku: d.sku ?? '',
    variants: d.variants ?? '[]',
    isDigital: d.isDigital ?? false,
    isFeatured: d.isFeatured ?? false,
    isActive: d.isActive ?? true,
    rating: d.rating ?? 0,
    reviewCount: d.reviewCount ?? 0,
    soldCount: d.soldCount ?? 0,
    createdAt: tsToISO(d.createdAt),
    updatedAt: tsToISO(d.updatedAt),
  };
}

function docToOrder(docSnap: DocumentSnapshot<DocumentData>): ShopOrder {
  const d = docSnap.data()!;
  return {
    id: docSnap.id,
    buyerId: d.buyerId ?? '',
    buyerName: d.buyerName ?? '',
    buyerEmail: d.buyerEmail ?? '',
    businessId: d.businessId ?? '',
    businessName: d.businessName ?? '',
    items: typeof d.items === 'string' ? d.items : JSON.stringify(d.items ?? []),
    subtotal: d.subtotal ?? 0,
    shipping: d.shipping ?? 0,
    tax: d.tax ?? 0,
    total: d.total ?? 0,
    status: d.status ?? 'pending',
    shippingAddress: typeof d.shippingAddress === 'string' ? d.shippingAddress : JSON.stringify(d.shippingAddress ?? {}),
    trackingNumber: d.trackingNumber ?? '',
    trackingPartner: d.trackingPartner ?? '',
    notes: d.notes ?? '',
    createdAt: tsToISO(d.createdAt),
    updatedAt: tsToISO(d.updatedAt),
  };
}

function docToReview(docSnap: DocumentSnapshot<DocumentData>): ShopReview {
  const d = docSnap.data()!;
  return {
    id: docSnap.id,
    productId: d.productId ?? '',
    buyerId: d.buyerId ?? '',
    buyerName: d.buyerName ?? '',
    buyerImage: d.buyerImage ?? '',
    rating: d.rating ?? 0,
    comment: d.comment ?? '',
    createdAt: tsToISO(d.createdAt),
  };
}

function docToShippingPartner(docSnap: DocumentSnapshot<DocumentData>): ShippingPartner {
  const d = docSnap.data()!;
  return {
    id: docSnap.id,
    name: d.name ?? '',
    logo: d.logo ?? '',
    isActive: d.isActive ?? true,
    baseRate: d.baseRate ?? 0,
    perKgRate: d.perKgRate ?? 0,
    estimatedDays: d.estimatedDays ?? '3-5',
    supportsCOD: d.supportsCOD ?? true,
    supportsPrepaid: d.supportsPrepaid ?? true,
  };
}

// ── Product Functions ────────────────────────────────────────────────────────

export async function createProduct(data: Omit<ShopProduct, 'id' | 'createdAt' | 'updatedAt' | 'rating' | 'reviewCount' | 'soldCount'>): Promise<ShopProduct> {
  const ref = await addDoc(collection(db, 'products'), {
    ...data,
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return docToProduct(snap);
}

export async function fetchProducts(
  limitCount: number,
  lastDoc?: DocumentSnapshot<DocumentData>,
  category?: string,
): Promise<{ products: ShopProduct[]; lastDoc: DocumentSnapshot<DocumentData> | null }> {
  const productsRef = collection(db, 'products');
  let q: ReturnType<typeof query>;

  const constraints = [
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
    firestoreLimit(limitCount),
  ];

  if (category && category !== 'All') {
    q = query(
      productsRef,
      where('isActive', '==', true),
      where('category', '==', category),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitCount),
    );
  } else {
    q = query(productsRef, ...constraints);
  }

  if (lastDoc) {
    const baseConstraints = category && category !== 'All'
      ? [
          where('isActive', '==', true),
          where('category', '==', category),
          orderBy('createdAt', 'desc'),
        ]
      : [
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
        ];
    q = query(productsRef, ...baseConstraints, startAfter(lastDoc), firestoreLimit(limitCount));
  }

  const snap = await getDocs(q);
  const products = snap.docs.map(docToProduct);
  const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { products, lastDoc: newLastDoc };
}

export async function fetchProductById(id: string): Promise<ShopProduct | null> {
  const ref = doc(db, 'products', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return docToProduct(snap);
}

export async function fetchBusinessProducts(
  businessId: string,
  limitCount: number,
  lastDoc?: DocumentSnapshot<DocumentData>,
): Promise<{ products: ShopProduct[]; lastDoc: DocumentSnapshot<DocumentData> | null }> {
  const productsRef = collection(db, 'products');
  const baseConstraints = [
    where('businessId', '==', businessId),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
  ];

  const q = lastDoc
    ? query(productsRef, ...baseConstraints, startAfter(lastDoc), firestoreLimit(limitCount))
    : query(productsRef, ...baseConstraints, firestoreLimit(limitCount));

  const snap = await getDocs(q);
  const products = snap.docs.map(docToProduct);
  const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { products, lastDoc: newLastDoc };
}

export async function updateProduct(id: string, data: Partial<ShopProduct>): Promise<void> {
  const ref = doc(db, 'products', id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteProduct(id: string): Promise<void> {
  const ref = doc(db, 'products', id);
  await updateDoc(ref, { isActive: false, updatedAt: serverTimestamp() });
}

export async function fetchFeaturedProducts(): Promise<ShopProduct[]> {
  const productsRef = collection(db, 'products');
  const q = query(
    productsRef,
    where('isFeatured', '==', true),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
    firestoreLimit(10),
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToProduct);
}

export async function fetchCategories(): Promise<string[]> {
  const productsRef = collection(db, 'products');
  const q = query(
    productsRef,
    where('isActive', '==', true),
    firestoreLimit(500),
  );
  const snap = await getDocs(q);
  const categories = new Set<string>();
  snap.docs.forEach((d) => {
    const cat = d.data().category;
    if (cat) categories.add(cat);
  });
  return Array.from(categories).sort();
}

export async function searchProducts(queryStr: string, limitCount: number = 20): Promise<ShopProduct[]> {
  const productsRef = collection(db, 'products');
  const q = query(
    productsRef,
    where('isActive', '==', true),
    where('name', '>=', queryStr),
    where('name', '<=', queryStr + '\uf8ff'),
    orderBy('name', 'asc'),
    firestoreLimit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToProduct);
}

// ── Order Functions ─────────────────────────────────────────────────────────

export async function createOrder(orderData: Omit<ShopOrder, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<ShopOrder> {
  const ref = await addDoc(collection(db, 'orders'), {
    ...orderData,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return docToOrder(snap);
}

export async function fetchBuyerOrders(buyerId: string): Promise<ShopOrder[]> {
  const ordersRef = collection(db, 'orders');
  const q = query(
    ordersRef,
    where('buyerId', '==', buyerId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToOrder);
}

export async function fetchBusinessOrders(businessId: string): Promise<ShopOrder[]> {
  const ordersRef = collection(db, 'orders');
  const q = query(
    ordersRef,
    where('businessId', '==', businessId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToOrder);
}

export async function updateOrderStatus(
  orderId: string,
  status: ShopOrder['status'],
  trackingNumber?: string,
): Promise<void> {
  const ref = doc(db, 'orders', orderId);
  const update: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (trackingNumber !== undefined) {
    update.trackingNumber = trackingNumber;
  }
  await updateDoc(ref, update);
}

// ── Review Functions ────────────────────────────────────────────────────────

export async function addReview(data: Omit<ShopReview, 'id' | 'createdAt'>): Promise<ShopReview> {
  const ref = await addDoc(collection(db, 'reviews'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return docToReview(snap);
}

export async function fetchProductReviews(productId: string): Promise<ShopReview[]> {
  const reviewsRef = collection(db, 'reviews');
  const q = query(
    reviewsRef,
    where('productId', '==', productId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToReview);
}

// ── Shipping Functions ──────────────────────────────────────────────────────

export async function fetchShippingPartners(): Promise<ShippingPartner[]> {
  const partnersRef = collection(db, 'shippingPartners');
  const q = query(partnersRef, where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(docToShippingPartner);
}

export function calculateShipping(
  partner: ShippingPartner,
  weight: number = 0.5,
  _pincode?: string,
): number {
  return partner.baseRate + (partner.perKgRate * weight);
}
