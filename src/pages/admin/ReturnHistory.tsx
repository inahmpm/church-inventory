import { useEffect, useState } from 'react';
import { subscribeBorrowRequests } from '../../lib/borrowRequests';
import { useActiveMinistry } from '../../lib/MinistryContext';
import type { BorrowRequest } from '../../types';

export default function ReturnHistory() {
  const { ministryId } = useActiveMinistry();
  const [requests, setRequests] = useState<BorrowRequest[]>([]);

  useEffect(() => {
    if (!ministryId) return;
    return subscribeBorrowRequests(['returned'], setRequests, ministryId);
  }, [ministryId]);

  const rows = requests
    .flatMap((r) =>
      r.items.map((item) => ({
        requestId: r.id,
        borrower: r.name,
        ministry: r.ministry,
        venue: r.venue,
        item: item.item,
        inventoryCode: item.inventoryCode,
        returnedAt: r.returnedAt,
      })),
    )
    .sort((a, b) => (b.returnedAt ?? 0) - (a.returnedAt ?? 0));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Return History</h1>

      {rows.length === 0 && (
        <div className="card text-center text-slate-400 py-10">No returned items yet.</div>
      )}

      {rows.length > 0 && (
        <>
          {/* Mobile card list */}
          <div className="space-y-2 sm:hidden">
            {rows.map((row) => (
              <div key={`${row.requestId}-${row.inventoryCode}`} className="card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{row.item}</span>
                  <span className="text-xs font-mono text-slate-400">{row.inventoryCode}</span>
                </div>
                <div className="text-xs text-slate-600">{row.borrower} · {row.ministry}</div>
                <div className="text-xs text-slate-500">{row.venue}</div>
                <div className="text-xs text-slate-400">
                  {row.returnedAt ? new Date(row.returnedAt).toLocaleString() : '—'}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop / tablet table */}
          <div className="card overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">QR Code</th>
                  <th className="py-2 pr-4 font-medium">Borrower</th>
                  <th className="py-2 pr-4 font-medium hidden md:table-cell">Ministry</th>
                  <th className="py-2 pr-4 font-medium hidden lg:table-cell">Venue</th>
                  <th className="py-2 pr-4 font-medium">Returned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={`${row.requestId}-${row.inventoryCode}`}>
                    <td className="py-2 pr-4 text-slate-800">{row.item}</td>
                    <td className="py-2 pr-4 font-mono text-slate-400">{row.inventoryCode}</td>
                    <td className="py-2 pr-4 text-slate-600">{row.borrower}</td>
                    <td className="py-2 pr-4 text-slate-600 hidden md:table-cell">{row.ministry}</td>
                    <td className="py-2 pr-4 text-slate-600 hidden lg:table-cell">{row.venue}</td>
                    <td className="py-2 pr-4 text-slate-400">
                      {row.returnedAt ? new Date(row.returnedAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
