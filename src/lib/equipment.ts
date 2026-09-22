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
  area: 'Area',
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
    if (key === 'customFields') {
      if (JSON.stringify(after.customFields ?? {}) !== JSON.stringify(before.customFields ?? {})) {
        changes.push('Custom Fields updated');
      }
      continue;
    }
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
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Omit<Equipment, 'id'>;
        return { id: d.id, ...data, area: data.area ?? '', customFields: data.customFields ?? {} };
      }),
    );
  });
}

export function generateInventoryCode(prefix: string, existingCodes: Iterable<string>): string {
  const taken = new Set(existingCodes);
  let code: string;
  do {
    const random = Math.floor(Math.random() * 10_000)
      .toString()
      .padStart(4, '0');
    code = `${prefix}-${random}`;
  } while (taken.has(code));
  return code;
}

// Strips a ministry's prefix (e.g. "TECH-") off a full inventory code, for
// display in an input where the prefix is shown separately. If the code
// doesn't carry that prefix, it's returned unchanged.
export function splitInventoryCode(prefix: string, code: string): string {
  const prefixWithDash = `${prefix}-`;
  return code.toUpperCase().startsWith(prefixWithDash.toUpperCase()) ? code.slice(prefixWithDash.length) : code;
}

// Builds a full inventory code from a ministry prefix and whatever a user
// typed for the rest — used when the prefix is shown as a fixed badge next
// to an editable suffix input.
export function joinInventoryCode(prefix: string, suffix: string): string {
  const trimmed = suffix.trim();
  return trimmed ? `${prefix}-${trimmed.toUpperCase()}` : '';
}

// Normalizes a raw, freely-typed code (e.g. from CSV import): if it already
// carries the ministry's prefix, it's used as-is; otherwise the prefix is
// prepended so a user can enter just the numeric/suffix part.
export function normalizeInventoryCode(prefix: string, raw: string): string {
  const trimmed = raw.trim();
  const prefixWithDash = `${prefix}-`;
  if (trimmed.toUpperCase().startsWith(prefixWithDash.toUpperCase())) {
    return trimmed.toUpperCase();
  }
  return `${prefix}-${trimmed.toUpperCase()}`;
}

export async function createEquipment(data: NewEquipment) {
  const existing = await findEquipmentByCode(data.ministryId, data.inventoryCode);
  if (existing) {
    throw new Error(`Inventory code "${data.inventoryCode}" is already used by "${existing.item}".`);
  }
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
  const data = d.data() as Omit<Equipment, 'id'>;
  return { id: d.id, ...data, area: data.area ?? '', customFields: data.customFields ?? {} };
}

