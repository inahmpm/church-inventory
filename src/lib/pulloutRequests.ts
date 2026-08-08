import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { logHistory } from './historyLogs';
import type { Equipment, PulloutItem, PulloutItemStatus, PulloutRequest, PulloutRequestStatus, NewPulloutRequest } from '../types';

const pulloutRequestsCol = collection(db, 'pulloutRequests');

function itemsCol(requestId: string) {
  return collection(db, 'pulloutRequests', requestId, 'items');
}

/** Per-item status is the source of truth; the request's status is always derived, never set directly. */
function computeRollupStatus(statuses: PulloutItemStatus[]): PulloutRequestStatus {
  if (statuses.length === 0) return 'draft';
  if (statuses.every((s) => s === 'returned' || s === 'missing')) return 'closed';
  if (statuses.some((s) => s === 'pulled_out' || s === 'returned' || s === 'missing')) return 'in_progress';
  return 'scheduled';
}

export async function createPulloutRequest(data: NewPulloutRequest): Promise<string> {
  const ref = await addDoc(pulloutRequestsCol, {
    ...data,
    status: 'draft',
    itemCount: 0,
    createdBy: auth.currentUser?.email ?? null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export function subscribePulloutRequests(
  ministryId: string,
  cb: (items: PulloutRequest[]) => void,
  statuses?: PulloutRequestStatus[],
) {
  const constraints = [where('ministryId', '==', ministryId)];
  if (statuses && statuses.length > 0) constraints.push(where('status', 'in', statuses));
  const q = query(pulloutRequestsCol, ...constraints, orderBy('pulloutAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PulloutRequest, 'id'>) })));
    },
    (err) => console.error('subscribePulloutRequests failed:', err),
  );
}

export function subscribePulloutRequest(requestId: string, cb: (req: PulloutRequest | null) => void) {
  return onSnapshot(
    doc(db, 'pulloutRequests', requestId),
    (snap) => {
      cb(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<PulloutRequest, 'id'>) } : null);
    },
    (err) => console.error('subscribePulloutRequest failed:', err),
  );
}

export function subscribePulloutItems(requestId: string, cb: (items: PulloutItem[]) => void) {
  const q = query(itemsCol(requestId), orderBy('category'), orderBy('item'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PulloutItem, 'id'>) })));
    },
    (err) => console.error('subscribePulloutItems failed:', err),
  );
}

/**
 * Cancels a pull-out request before verification has started, releasing the
 * equipment lock on every attached item and deleting the request entirely.
 */
export async function cancelPulloutRequest(requestId: string, ministryId: string) {
  const itemsSnap = await getDocs(itemsCol(requestId));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PulloutItem, 'id'>) }));

  await runTransaction(db, async (tx) => {
    const reqRef = doc(db, 'pulloutRequests', requestId);
    const reqSnap = await tx.get(reqRef);
    const req = reqSnap.data() as PulloutRequest | undefined;
    if (!req) throw new Error('Pull-out request not found');
    if (req.status === 'in_progress' || req.status === 'closed') {
      throw new Error('Cannot cancel a pull-out request once verification has started');
    }

    const now = Date.now();
    for (const item of items) {
      tx.delete(doc(itemsCol(requestId), item.id));
      tx.update(doc(db, 'equipment', item.equipmentId), {
        pulloutStatus: null,
        activePulloutRequestId: null,
        updatedAt: now,
      });
    }
    tx.delete(reqRef);
  });

  await Promise.all(
    items.map((item) =>
      logHistory({
        ministryId,
        equipmentId: item.equipmentId,
        inventoryCode: item.inventoryCode,
        item: item.item,
        action: 'pullout_removed',
        details: `Pull-out request (${requestId}) cancelled`,
      }),
    ),
  );
}

/**
 * Attaches equipment to a pull-out request. Runs as a transaction so an item
 * can't be attached to two active pull-outs (or a pull-out and a borrow) at
 * once. Immediately locks each attached item's equipment record — the lock
 * takes effect on save, not "at midnight of the pull-out date".
 */
export async function attachItems(requestId: string, ministryId: string, equipmentIds: string[]) {
  if (equipmentIds.length === 0) return;

  const attached = await runTransaction(db, async (tx) => {
    const reqRef = doc(db, 'pulloutRequests', requestId);
    const reqSnap = await tx.get(reqRef);
    const req = reqSnap.data() as PulloutRequest | undefined;
    if (!req) throw new Error('Pull-out request not found');
    if (req.status === 'in_progress' || req.status === 'closed') {
      throw new Error('Cannot attach items once pull-out verification has started');
    }

    const equipRefs = equipmentIds.map((id) => doc(db, 'equipment', id));
    const equipSnaps = await Promise.all(equipRefs.map((ref) => tx.get(ref)));

    const newItems: Omit<PulloutItem, 'id'>[] = [];
    for (let i = 0; i < equipSnaps.length; i++) {
      const equip = equipSnaps[i].data() as Equipment | undefined;
      const equipmentId = equipmentIds[i];
      if (!equip) throw new Error('One of the selected equipment items no longer exists');
      if (equip.isBorrowed) throw new Error(`"${equip.item}" is currently borrowed and cannot be pulled out`);
      if (equip.pulloutStatus) throw new Error(`"${equip.item}" is already on another pull-out request`);
      newItems.push({
        equipmentId,
        inventoryCode: equip.inventoryCode,
        item: equip.item,
        category: equip.category,
        subcategory: equip.subcategory,
        itemStatus: 'for_pullout',
        scannedOutAt: null,
        scannedOutBy: null,
        scannedInAt: null,
        scannedInBy: null,
        conditionNoteOnReturn: null,
      });
    }

    const now = Date.now();
    for (const item of newItems) {
      tx.set(doc(itemsCol(requestId)), item);
      tx.update(doc(db, 'equipment', item.equipmentId), {
        pulloutStatus: 'for_pullout',
        activePulloutRequestId: requestId,
        updatedAt: now,
      });
    }

    tx.update(reqRef, {
      itemCount: req.itemCount + newItems.length,
      status: 'scheduled',
      updatedAt: now,
    });

    return newItems;
  });

  await Promise.all(
    attached.map((item) =>
      logHistory({
        ministryId,
        equipmentId: item.equipmentId,
        inventoryCode: item.inventoryCode,
        item: item.item,
        action: 'pullout_scheduled',
        details: `Attached to pull-out request (${requestId})`,
      }),
    ),
  );
}

/** Detaches an item before pull-out (only while it's still awaiting pull-out) and releases its equipment lock. */
export async function removeAttachedItem(requestId: string, ministryId: string, itemId: string) {
  const itemRef = doc(itemsCol(requestId), itemId);
  const reqRef = doc(db, 'pulloutRequests', requestId);

  const removed = await runTransaction(db, async (tx) => {
    const itemSnap = await tx.get(itemRef);
    const item = itemSnap.data() as PulloutItem | undefined;
    if (!item) throw new Error('Item not found on this request');
    if (item.itemStatus !== 'for_pullout') {
      throw new Error('Only items awaiting pull-out can be removed from the request');
    }
    const reqSnap = await tx.get(reqRef);
    const req = reqSnap.data() as PulloutRequest | undefined;
    if (!req) throw new Error('Pull-out request not found');

    tx.delete(itemRef);
    tx.update(doc(db, 'equipment', item.equipmentId), {
      pulloutStatus: null,
      activePulloutRequestId: null,
      updatedAt: Date.now(),
    });
    const itemCount = Math.max(0, req.itemCount - 1);
    tx.update(reqRef, {
      itemCount,
      status: itemCount === 0 ? 'draft' : 'scheduled',
      updatedAt: Date.now(),
    });
    return item;
  });

  await logHistory({
    ministryId,
    equipmentId: removed.equipmentId,
    inventoryCode: removed.inventoryCode,
    item: removed.item,
    action: 'pullout_removed',
    details: `Removed from pull-out request (${requestId}) before pull-out`,
  });
}

/** Scans one QR code and marks the matching item pulled out (Step 3). */
export async function scanItemOut(requestId: string, inventoryCode: string, adminEmail: string | null) {
  const matchSnap = await getDocs(query(itemsCol(requestId), where('inventoryCode', '==', inventoryCode)));
  if (matchSnap.empty) throw new Error(`"${inventoryCode}" isn't on this pull-out request.`);
  const targetId = matchSnap.docs[0].id;
  const allIds = (await getDocs(itemsCol(requestId))).docs.map((d) => d.id);

  const result = await runTransaction(db, async (tx) => {
    const reqRef = doc(db, 'pulloutRequests', requestId);
    const targetRef = doc(itemsCol(requestId), targetId);
    const otherRefs = allIds.filter((id) => id !== targetId).map((id) => doc(itemsCol(requestId), id));

    const [reqSnap, targetSnap, ...otherSnaps] = await Promise.all([
      tx.get(reqRef),
      tx.get(targetRef),
      ...otherRefs.map((ref) => tx.get(ref)),
    ]);

    const req = reqSnap.data() as PulloutRequest | undefined;
    if (!req) throw new Error('Pull-out request not found');
    const item = targetSnap.data() as PulloutItem | undefined;
    if (!item) throw new Error('Item not found on this request');
    if (item.itemStatus === 'pulled_out') throw new Error(`"${item.item}" was already scanned out.`);
    if (item.itemStatus !== 'for_pullout') {
      throw new Error(`"${item.item}" cannot be scanned out from its current status.`);
    }

    const now = Date.now();
    tx.update(targetRef, { itemStatus: 'pulled_out', scannedOutAt: now, scannedOutBy: adminEmail });
    tx.update(doc(db, 'equipment', item.equipmentId), { pulloutStatus: 'pulled_out', updatedAt: now });

    const statuses = otherSnaps
      .map((s) => (s.data() as PulloutItem | undefined)?.itemStatus)
      .filter((s): s is PulloutItemStatus => !!s)
      .concat('pulled_out');
    tx.update(reqRef, { status: computeRollupStatus(statuses), updatedAt: now });

    return { item, ministryId: req.ministryId };
  });

  await logHistory({
    ministryId: result.ministryId,
    equipmentId: result.item.equipmentId,
    inventoryCode: result.item.inventoryCode,
    item: result.item.item,
    action: 'pullout_scanned_out',
    details: `Scanned out for pull-out request (${requestId})`,
  });
  return result.item;
}

/**
 * Scans one QR code and marks the matching item returned (Step 4). Re-scanning
 * an item already marked returned is a silent no-op, since re-scanning by
 * habit is expected.
 */
export async function scanItemIn(requestId: string, inventoryCode: string, adminEmail: string | null) {
  const matchSnap = await getDocs(query(itemsCol(requestId), where('inventoryCode', '==', inventoryCode)));
  if (matchSnap.empty) throw new Error(`"${inventoryCode}" isn't on this pull-out request.`);
  const targetId = matchSnap.docs[0].id;
  const allIds = (await getDocs(itemsCol(requestId))).docs.map((d) => d.id);

  const result = await runTransaction(db, async (tx) => {
    const reqRef = doc(db, 'pulloutRequests', requestId);
    const targetRef = doc(itemsCol(requestId), targetId);
    const otherRefs = allIds.filter((id) => id !== targetId).map((id) => doc(itemsCol(requestId), id));

    const [reqSnap, targetSnap, ...otherSnaps] = await Promise.all([
      tx.get(reqRef),
      tx.get(targetRef),
      ...otherRefs.map((ref) => tx.get(ref)),
    ]);

    const req = reqSnap.data() as PulloutRequest | undefined;
    if (!req) throw new Error('Pull-out request not found');
    const item = targetSnap.data() as PulloutItem | undefined;
    if (!item) throw new Error('Item not found on this request');

    if (item.itemStatus === 'returned') {
      return { item, ministryId: req.ministryId, noop: true as const };
    }
    if (item.itemStatus !== 'pulled_out' && item.itemStatus !== 'missing') {
      throw new Error(`"${item.item}" hasn't been scanned out yet.`);
    }

    const now = Date.now();
    tx.update(targetRef, { itemStatus: 'returned', scannedInAt: now, scannedInBy: adminEmail });
    tx.update(doc(db, 'equipment', item.equipmentId), {
      pulloutStatus: null,
      activePulloutRequestId: null,
      updatedAt: now,
    });

    const statuses = otherSnaps
      .map((s) => (s.data() as PulloutItem | undefined)?.itemStatus)
      .filter((s): s is PulloutItemStatus => !!s)
      .concat('returned');
    tx.update(reqRef, { status: computeRollupStatus(statuses), updatedAt: now });

    return { item: { ...item, itemStatus: 'returned' as const }, ministryId: req.ministryId, noop: false as const };
  });

  if (!result.noop) {
    await logHistory({
      ministryId: result.ministryId,
      equipmentId: result.item.equipmentId,
      inventoryCode: result.item.inventoryCode,
      item: result.item.item,
      action: 'pullout_scanned_in',
      details: `Scanned in (returned) for pull-out request (${requestId})`,
    });
  }
  return result;
}

/**
 * Reports an un-returned item missing, closing it out of the request without
 * clearing its equipment lock — a Ministry Admin must resolve it manually
 * from the Equipment record.
 */
export async function markItemMissing(
  requestId: string,
  ministryId: string,
  itemId: string,
  note: string,
) {
  const allIds = (await getDocs(itemsCol(requestId))).docs.map((d) => d.id);

  const result = await runTransaction(db, async (tx) => {
    const reqRef = doc(db, 'pulloutRequests', requestId);
    const targetRef = doc(itemsCol(requestId), itemId);
    const otherRefs = allIds.filter((id) => id !== itemId).map((id) => doc(itemsCol(requestId), id));

    const [reqSnap, targetSnap, ...otherSnaps] = await Promise.all([
      tx.get(reqRef),
      tx.get(targetRef),
      ...otherRefs.map((ref) => tx.get(ref)),
    ]);

    const req = reqSnap.data() as PulloutRequest | undefined;
    if (!req) throw new Error('Pull-out request not found');
    const item = targetSnap.data() as PulloutItem | undefined;
    if (!item) throw new Error('Item not found on this request');
    if (item.itemStatus === 'returned') throw new Error(`"${item.item}" was already returned.`);

    const now = Date.now();
    tx.update(targetRef, { itemStatus: 'missing', conditionNoteOnReturn: note || null });
    tx.update(doc(db, 'equipment', item.equipmentId), { updatedAt: now });

    const statuses = otherSnaps
      .map((s) => (s.data() as PulloutItem | undefined)?.itemStatus)
      .filter((s): s is PulloutItemStatus => !!s)
      .concat('missing');
    tx.update(reqRef, { status: computeRollupStatus(statuses), updatedAt: now });

    return item;
  });

  await logHistory({
    ministryId,
    equipmentId: result.equipmentId,
    inventoryCode: result.inventoryCode,
    item: result.item,
    action: 'pullout_missing',
    details: `Marked missing on pull-out request (${requestId})${note ? `: ${note}` : ''}`,
  });
}

/**
 * Resolves a previously missing item once it's been located — marks it
 * returned and releases its equipment lock, without requiring a fresh QR scan.
 */
export async function markItemFound(
  requestId: string,
  ministryId: string,
  itemId: string,
  adminEmail: string | null,
) {
  const allIds = (await getDocs(itemsCol(requestId))).docs.map((d) => d.id);

  const result = await runTransaction(db, async (tx) => {
    const reqRef = doc(db, 'pulloutRequests', requestId);
    const targetRef = doc(itemsCol(requestId), itemId);
    const otherRefs = allIds.filter((id) => id !== itemId).map((id) => doc(itemsCol(requestId), id));

    const [reqSnap, targetSnap, ...otherSnaps] = await Promise.all([
      tx.get(reqRef),
      tx.get(targetRef),
      ...otherRefs.map((ref) => tx.get(ref)),
    ]);

    const req = reqSnap.data() as PulloutRequest | undefined;
    if (!req) throw new Error('Pull-out request not found');
    const item = targetSnap.data() as PulloutItem | undefined;
    if (!item) throw new Error('Item not found on this request');
    if (item.itemStatus !== 'missing') throw new Error(`"${item.item}" isn't marked missing.`);

    const now = Date.now();
    tx.update(targetRef, {
      itemStatus: 'returned',
      scannedInAt: now,
      scannedInBy: adminEmail,
      conditionNoteOnReturn: null,
    });
    tx.update(doc(db, 'equipment', item.equipmentId), {
      pulloutStatus: null,
      activePulloutRequestId: null,
      updatedAt: now,
    });

    const statuses = otherSnaps
      .map((s) => (s.data() as PulloutItem | undefined)?.itemStatus)
      .filter((s): s is PulloutItemStatus => !!s)
      .concat('returned');
    tx.update(reqRef, { status: computeRollupStatus(statuses), updatedAt: now });

    return item;
  });

  await logHistory({
    ministryId,
    equipmentId: result.equipmentId,
    inventoryCode: result.inventoryCode,
    item: result.item,
    action: 'pullout_found',
    details: `Missing item found and resolved on pull-out request (${requestId})`,
  });
}
