import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'

/**
 * Create a new 1-on-1 chat between two users, or return the existing one.
 * Searches for a chat where both user IDs match in either order.
 */
export async function createOrGetChat(myId: string, otherId: string) {
  // Query for existing chat between these two users
  const q1 = query(
    collection(db, 'chats'),
    where('user1Id', '==', myId),
    where('user2Id', '==', otherId)
  )
  const q2 = query(
    collection(db, 'chats'),
    where('user1Id', '==', otherId),
    where('user2Id', '==', myId)
  )

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])

  if (!snap1.empty) {
    const doc = snap1.docs[0]
    return { id: doc.id, ...doc.data() }
  }
  if (!snap2.empty) {
    const doc = snap2.docs[0]
    return { id: doc.id, ...doc.data() }
  }

  // No existing chat — create one
  const docRef = await addDoc(collection(db, 'chats'), {
    user1Id: myId,
    user2Id: otherId,
    isPaidChat: false,
    chatPrice: 0,
    isPaidBy: null,
    isDeleted: false,
    unreadCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return {
    id: docRef.id,
    user1Id: myId,
    user2Id: otherId,
    isPaidChat: false,
    chatPrice: 0,
    isPaidBy: null,
    isDeleted: false,
    unreadCount: 0,
  }
}
