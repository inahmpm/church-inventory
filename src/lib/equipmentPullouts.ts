import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { logHistory } from './historyLogs';
import type { EquipmentPullout, NewEquipmentPullout } from '../types';

const pulloutsCol = collection(db, 'equipmentPullouts');

export function subscribePullouts(ministryId: string, cb: (items: EquipmentPullout[]) => void) {
  const q = query(pulloutsCol, where('ministryId', '==', ministryId), orderBy('pulloutAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EquipmentPullout, 'id'>) })));
  });
}

export async function createPullout(data: NewEquipmentPullout) {
  await addDoc(pulloutsCol, {
    ...data,
    actor: auth.currentUser?.email ?? null,
    createdAt: Date.now(),
  });
  await logHistory({
    ministryId: data.ministryId,
    equipmentId: data.equipmentId,
    inventoryCode: data.inventoryCode,
    item: data.item,
    action: 'pulled_out',
    details: `Pulled out to ${data.area} on ${new Date(data.pulloutAt).toLocaleString()}`,
  }).catch((err) => console.error('Failed to log history for equipment pullout', err));
}

export async function deletePullout(id: string) {
  await deleteDoc(doc(db, 'equipmentPullouts', id));
}
