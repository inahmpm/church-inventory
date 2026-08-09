import { useEffect, useState } from 'react';
import { markItemsReturned, subscribeBorrowRequests } from '../../lib/borrowRequests';
import { useActiveMinistry } from '../../lib/MinistryContext';
import type { BorrowRequest } from '../../types';

export default function ActiveBorrows() {
  const { ministryId } = useActiveMinistry();
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [returning, setReturning] = useState<string | null>(null);

  useEffect(() => {
    if (!ministryId) return;
    return subscribeBorrowRequests(['borrowed'], setRequests, ministryId);
  }, [ministryId]);

  const active = requests.filter((r) => r.fulfilledAt);

  async function handleReturn(r: BorrowRequest) {
    if (!confirm(`Mark all ${r.items.length} item(s) borrowed by ${r.name} as returned?`)) return;
    setReturning(r.id);
    try {
      await markItemsReturned(r.id);
    } finally {
      setReturning(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Active Borrows</h1>

      {active.length === 0 && (
        <div className="card text-center text-slate-400 py-10">No equipment currently out on loan.</div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {active.map((r) => (
          <div key={r.id} className="card">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold text-slate-800">{r.name}</div>
                <div className="text-sm text-slate-500">
                  {r.ministry} · {r.venue}
                </div>
              </div>
              <div className="text-xs text-slate-400 text-right">
                Handed out
                <br />
                {r.fulfilledAt && new Date(r.fulfilledAt).toLocaleString()}
              </div>
            </div>
            <ul className="text-sm text-slate-600 divide-y divide-slate-100 mb-4">
              {r.items.map((item) => (
                <li key={item.equipmentId} className="py-1.5 flex justify-between">
                  <span>{item.item}</span>
                  <span className="font-mono text-slate-400">{item.inventoryCode}</span>
                </li>
              ))}
            </ul>
            <button
              className="btn-primary w-full"
              disabled={returning === r.id}
              onClick={() => handleReturn(r)}
            >
              {returning === r.id ? 'Saving...' : 'Item/s Returned'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
