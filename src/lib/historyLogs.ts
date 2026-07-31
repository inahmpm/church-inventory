import { addDoc, collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { HistoryLogAction, HistoryLogEntry } from '../types';

const historyLogsCol = collection(db, 'historyLogs');

export const HISTORY_LOG_ACTION_LABELS: Record<HistoryLogAction, string> = {
  created: 'Added',
  updated: 'Updated',
  deleted: 'Deleted',
  borrowed: 'Borrowed',
  removed: 'Removed from request',
  handed_out: 'Handed out',
  returned: 'Returned',
  pulled_out: 'Pulled out',
};

export const HISTORY_LOG_ACTION_COLORS: Record<HistoryLogAction, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-slate-100 text-slate-600',
  deleted: 'bg-red-100 text-red-700',
  borrowed: 'bg-amber-100 text-amber-700',
  removed: 'bg-orange-100 text-orange-700',
  handed_out: 'bg-sky-100 text-sky-700',
  returned: 'bg-lime-100 text-lime-700',
  pulled_out: 'bg-purple-100 text-purple-700',
};

export function logHistory(entry: {
  ministryId: string;
  equipmentId: string;
  inventoryCode: string;
  item: string;
  action: HistoryLogAction;
  details: string;
}) {
  return addDoc(historyLogsCol, {
    ...entry,
    actor: auth.currentUser?.email ?? null,
    timestamp: Date.now(),
  });
}

export function subscribeHistoryLogs(
  ministryId: string,
  cb: (items: HistoryLogEntry[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(historyLogsCol, where('ministryId', '==', ministryId), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HistoryLogEntry, 'id'>) })));
    },
    (err) => {
      console.error('Failed to subscribe to history logs', err);
      onError?.(err);
    },
  );
}
