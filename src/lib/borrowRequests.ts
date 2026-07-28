import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { logHistory } from './historyLogs';
import { getMinistry } from './ministries';
import { itemsListHtml, sendTemplateEmail } from './emailjs';
import type { BorrowRequest, BorrowedItem } from '../types';

const requestsCol = collection(db, 'borrowRequests');
const equipmentCol = collection(db, 'equipment');
const mailCol = collection(db, 'mail');

const handedOutTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_HANDED_OUT;
const returnedTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_RETURNED;

function sendMail(ministryId: string, to: string, subject: string, html: string) {
  return addDoc(mailCol, { ministryId, to, message: { subject, html } });
}

export interface PublicBorrowInput {
  ministryId: string;
  name: string;
  email: string;
  ministry: string;
  contactNo: string;
  venue: string;
  equipmentRequested: string;
}

export async function submitBorrowRequest(input: PublicBorrowInput, notificationEmail: string) {
  await addDoc(requestsCol, {
    ...input,
    status: 'pending',
    items: [],
    submittedAt: Date.now(),
    submittedAtServer: serverTimestamp(),
    fulfilledAt: null,
    returnedAt: null,
  });
  const requestSummary = `<ul>
       <li><strong>Contact No.:</strong> ${input.contactNo}</li>
       <li><strong>Venue:</strong> ${input.venue}</li>
       <li><strong>Equipment requested:</strong> ${input.equipmentRequested}</li>
     </ul>`;
  const mails = [
    sendMail(
      input.ministryId,
      notificationEmail,
      `New borrow request from ${input.name}`,
      `<p><strong>${input.name}</strong> (${input.ministry}) submitted a new equipment borrow request.</p>${requestSummary}`,
    ),
  ];
  if (input.email) {
    mails.push(
      sendMail(
        input.ministryId,
        input.email,
        'Your borrow request was submitted',
        `<p>Hi ${input.name}, your equipment borrow request has been received and is pending approval.</p>${requestSummary}`,
      ),
    );
  }
  await Promise.all(mails);
}

export function subscribeBorrowRequests(
  statuses: BorrowRequest['status'][],
  cb: (items: BorrowRequest[]) => void,
  ministryId: string,
) {
  const q = query(
    requestsCol,
    where('ministryId', '==', ministryId),
    where('status', 'in', statuses),
    orderBy('submittedAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BorrowRequest, 'id'>) })));
  });
}

/**
 * Scans one barcode and attaches the matching equipment to a pending request.
 * Runs as a transaction so an item can't be attached to two active borrows at once.
 */
export async function scanEquipmentIntoRequest(requestId: string, ministryId: string, inventoryCode: string) {
  const q = query(
    equipmentCol,
    where('ministryId', '==', ministryId),
    where('inventoryCode', '==', inventoryCode),
  );
  const snap = await getDocs(q);
  if (snap.empty) throw new Error(`No equipment found with barcode "${inventoryCode}"`);
  const newItem = await runTransaction(db, async (tx) => {
    const equipDoc = snap.docs[0];
    const equipRef = doc(db, 'equipment', equipDoc.id);
    const equipSnapshot = await tx.get(equipRef);
    const equip = equipSnapshot.data();
    if (!equip) throw new Error('Equipment record not found');
    if (equip.assignedType === 'Fixed') {
      throw new Error(`"${equip.item}" (${inventoryCode}) is a fixed installation and cannot be borrowed`);
    }
    if (equip.assignedType === 'Issued') {
      throw new Error(`"${equip.item}" (${inventoryCode}) is issued to ${equip.assignedTo || 'someone'} and cannot be borrowed`);
    }
    if (equip.isBorrowed) throw new Error(`"${equip.item}" (${inventoryCode}) is already borrowed`);

    const reqRef = doc(db, 'borrowRequests', requestId);
    const reqSnap = await tx.get(reqRef);
    const req = reqSnap.data() as BorrowRequest | undefined;
    if (!req) throw new Error('Borrow request not found');
    if (req.items.some((i) => i.inventoryCode === inventoryCode)) {
      throw new Error(`"${equip.item}" is already added to this request`);
    }

    const newItem: BorrowedItem = {
      equipmentId: equipDoc.id,
      inventoryCode,
      item: equip.item,
      category: equip.category,
    };

    tx.update(equipRef, { isBorrowed: true, activeBorrowRequestId: requestId, updatedAt: Date.now() });
    tx.update(reqRef, { items: [...req.items, newItem], status: 'borrowed' as const });

    return newItem;
  });
  await logHistory({
    ministryId,
    equipmentId: newItem.equipmentId,
    inventoryCode: newItem.inventoryCode,
    item: newItem.item,
    action: 'borrowed',
    details: `Scanned into a borrow request (${requestId})`,
  });
  return newItem;
}

export async function removeItemFromRequest(requestId: string, equipmentId: string) {
  const result = await runTransaction(db, async (tx) => {
    const reqRef = doc(db, 'borrowRequests', requestId);
    const equipRef = doc(db, 'equipment', equipmentId);
    const reqSnap = await tx.get(reqRef);
    const req = reqSnap.data() as BorrowRequest | undefined;
    if (!req) throw new Error('Borrow request not found');
    const removed = req.items.find((i) => i.equipmentId === equipmentId);
    const items = req.items.filter((i) => i.equipmentId !== equipmentId);
    tx.update(reqRef, { items, status: items.length ? 'borrowed' : 'pending' });
    tx.update(equipRef, { isBorrowed: false, activeBorrowRequestId: null, updatedAt: Date.now() });
    return removed ? { removed, ministryId: req.ministryId } : null;
  });
  if (result) {
    await logHistory({
      ministryId: result.ministryId,
      equipmentId: result.removed.equipmentId,
      inventoryCode: result.removed.inventoryCode,
      item: result.removed.item,
      action: 'removed',
      details: `Removed from borrow request (${requestId}) before hand-out`,
    });
  }
}

export async function finalizeRequest(requestId: string) {
  const reqRef = doc(db, 'borrowRequests', requestId);
  const req = await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(reqRef);
    const req = reqSnap.data() as BorrowRequest | undefined;
    if (!req) throw new Error('Borrow request not found');
    if (!req.items.length) throw new Error('Scan at least one item before finalizing');
    tx.update(reqRef, { fulfilledAt: Date.now() });
    return req;
  });
  await Promise.all(
    req.items.map((item) =>
      logHistory({
        ministryId: req.ministryId,
        equipmentId: item.equipmentId,
        inventoryCode: item.inventoryCode,
        item: item.item,
        action: 'handed_out',
        details: `Handed out to ${req.name} (${req.ministry}) for request ${requestId}`,
      }),
    ),
  );
  const ministry = await getMinistry(req.ministryId);
  const mails = [
    sendTemplateEmail(handedOutTemplateId, {
      to_email: req.email,
      to_name: req.name,
      items_list: itemsListHtml(req.items),
    }),
  ];
  if (ministry?.notificationEmail) {
    mails.push(
      sendTemplateEmail(handedOutTemplateId, {
        to_email: ministry.notificationEmail,
        to_name: `${req.name} (${req.ministry})`,
        items_list: itemsListHtml(req.items),
      }),
    );
  }
  await Promise.all(mails);
}

export async function markItemsReturned(requestId: string) {
  const reqRef = doc(db, 'borrowRequests', requestId);
  const req = await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(reqRef);
    const req = reqSnap.data() as BorrowRequest | undefined;
    if (!req) throw new Error('Borrow request not found');
    for (const item of req.items) {
      tx.update(doc(db, 'equipment', item.equipmentId), {
        isBorrowed: false,
        activeBorrowRequestId: null,
        updatedAt: Date.now(),
      });
    }
    tx.update(reqRef, { status: 'returned', returnedAt: Date.now() });
    return req;
  });
  await Promise.all(
    req.items.map((item) =>
      logHistory({
        ministryId: req.ministryId,
        equipmentId: item.equipmentId,
        inventoryCode: item.inventoryCode,
        item: item.item,
        action: 'returned',
        details: `Returned by ${req.name} (${req.ministry}) for request ${requestId}`,
      }),
    ),
  );
  const ministry = await getMinistry(req.ministryId);
  const mails = [
    sendTemplateEmail(returnedTemplateId, {
      to_email: req.email,
      to_name: req.name,
      items_list: itemsListHtml(req.items),
    }),
  ];
  if (ministry?.notificationEmail) {
    mails.push(
      sendTemplateEmail(returnedTemplateId, {
        to_email: ministry.notificationEmail,
        to_name: `${req.name} (${req.ministry})`,
        items_list: itemsListHtml(req.items),
      }),
    );
  }
  await Promise.all(mails);
}
