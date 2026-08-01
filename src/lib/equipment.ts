import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { logHistory } from './historyLogs';
import type { Equipment, NewEquipment } from '../types';

const equipmentCol = collection(db, 'equipment');

const FIELD_LABELS: Partial<Record<keyof NewEquipment, string>> = {
  category: 'Category',
  subcategory: 'Sub-Category',
  inventoryCode: 'Inventory Code',
  item: 'Item',
  serialNumber: 'Serial Number',
  assignedType: 'Assigned Type',
  assignedTo: 'Assigned To',
  department: 'Department',
  ministry: 'Ministry',
  location: 'Location',
  purchaseDate: 'Purchase Date',
  status: 'Status',
  statusDetails: 'Status Details',
};

function formatValue(value: unknown): string {
  if (value === '' || value === null || value === undefined) return '(empty)';
  return String(value);
}

function describeChanges(before: Equipment, after: Partial<NewEquipment>): string {
  const changes: string[] = [];
  for (const key of Object.keys(after) as (keyof NewEquipment)[]) {
    const newValue = after[key];
    const oldValue = before[key];
    if (newValue === oldValue) continue;
    const label = FIELD_LABELS[key] ?? key;
    changes.push(`${label}: ${formatValue(oldValue)} → ${formatValue(newValue)}`);
  }
  return changes.length > 0 ? changes.join('\n') : 'No changes';
}

export function subscribeEquipment(ministryId: string, cb: (items: Equipment[]) => void) {
  const q = query(equipmentCol, where('ministryId', '==', ministryId), orderBy('category'), orderBy('item'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Equipment, 'id'>) })));
  });
}

export async function createEquipment(data: NewEquipment) {
  const ref = await addDoc(equipmentCol, {
    ...data,
    isBorrowed: false,
    activeBorrowRequestId: null,
    pulloutStatus: null,
    activePulloutRequestId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  await logHistory({
    ministryId: data.ministryId,
    equipmentId: ref.id,
    inventoryCode: data.inventoryCode,
    item: data.item,
    action: 'created',
    details: `Added to inventory as ${data.assignedType}`,
  }).catch((err) => console.error('Failed to log history for created equipment', err));
}

export async function updateEquipment(id: string, data: Partial<NewEquipment>, before?: Equipment) {
  await updateDoc(doc(db, 'equipment', id), { ...data, updatedAt: Date.now() });
  await logHistory({
    ministryId: data.ministryId ?? before?.ministryId ?? '',
    equipmentId: id,
    inventoryCode: data.inventoryCode ?? before?.inventoryCode ?? '',
    item: data.item ?? before?.item ?? '',
    action: 'updated',
    details: before ? describeChanges(before, data) : `Updated: ${Object.keys(data).join(', ')}`,
  }).catch((err) => console.error('Failed to log history for updated equipment', err));
}

export async function deleteEquipment(
  id: string,
  equipment: Pick<Equipment, 'ministryId' | 'inventoryCode' | 'item'>,
) {
  await deleteDoc(doc(db, 'equipment', id));
  await logHistory({
    ministryId: equipment.ministryId,
    equipmentId: id,
    inventoryCode: equipment.inventoryCode,
    item: equipment.item,
    action: 'deleted',
    details: 'Removed from inventory',
  }).catch((err) => console.error('Failed to log history for deleted equipment', err));
}

const FIRESTORE_BATCH_LIMIT = 500;

export async function deleteEquipmentBulk(
  items: Pick<Equipment, 'id' | 'ministryId' | 'inventoryCode' | 'item'>[],
  details = 'Removed from inventory (bulk delete)',
) {
  for (let i = 0; i < items.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = items.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.delete(doc(db, 'equipment', item.id));
    }
    await batch.commit();
  }
  await Promise.all(
    items.map((item) =>
      logHistory({
        ministryId: item.ministryId,
        equipmentId: item.id,
        inventoryCode: item.inventoryCode,
        item: item.item,
        action: 'deleted',
        details,
      }).catch((err) => console.error('Failed to log history for bulk-deleted equipment', err)),
    ),
  );
}

export async function findEquipmentByCode(ministryId: string, inventoryCode: string): Promise<Equipment | null> {
  const q = query(
    equipmentCol,
    where('ministryId', '==', ministryId),
    where('inventoryCode', '==', inventoryCode),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Equipment, 'id'>) };
}

