import { useEffect, useState } from 'react';
import { subscribeBorrowRequests } from '../../lib/borrowRequests';
import { HISTORY_LOG_ACTION_COLORS, HISTORY_LOG_ACTION_LABELS } from '../../lib/historyLogs';
import { useCurrentUser } from '../../lib/useCurrentUser';
import type { BorrowRequest } from '../../types';

export default function BorrowRequestHistory() {
  const { profile } = useCurrentUser();
  const ministryId = profile?.ministryId;
  const [requests, setRequests] = useState<BorrowRequest[]>([]);

  useEffect(() => {
    if (!ministryId) return;
    return subscribeBorrowRequests(['returned', 'denied'], setRequests, ministryId);
  }, [ministryId]);

  const rows = [...requests].sort(
    (a, b) => (b.returnedAt ?? b.deniedAt ?? 0) - (a.returnedAt ?? a.deniedAt ?? 0),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Borrow Request History</h1>

      {rows.length === 0 && (
        <div className="card text-center text-slate-400 py-10">No past requests yet.</div>
      )}

      {rows.length > 0 && (
        <>
          {/* Mobile card list */}
          <div className="space-y-2 sm:hidden">
            {rows.map((r) => (
              <div key={r.id} className="card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{r.name}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-xs text-slate-500">{r.ministry} · {r.venue}</div>
                <div className="text-xs text-slate-500 truncate">{r.contactNo} · {r.email}</div>
                <div className="text-xs text-slate-500 truncate">Requested: {r.equipmentRequested}</div>
                <div className="text-xs text-slate-400">{r.items.length} item(s)</div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Submitted: {new Date(r.submittedAt).toLocaleString()}</span>
                  <span>
                    {r.status === 'denied' ? 'Denied' : 'Returned'}:{' '}
                    {(r.returnedAt ?? r.deniedAt) ? new Date((r.returnedAt ?? r.deniedAt) as number).toLocaleString() : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop / tablet table */}
          <div className="card p-0 overflow-x-auto hidden sm:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <Th>Submitted</Th>
                  <Th>Name</Th>
                  <Th className="hidden lg:table-cell">Ministry</Th>
                  <Th className="hidden lg:table-cell">Contact</Th>
                  <Th className="hidden md:table-cell">Venue</Th>
                  <Th className="hidden xl:table-cell">Requested Equipment</Th>
                  <Th>Items</Th>
                  <Th>Status</Th>
                  <Th>Returned / Denied</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap">{new Date(r.submittedAt).toLocaleString()}</Td>
                    <Td>{r.name}</Td>
                    <Td className="hidden lg:table-cell">{r.ministry}</Td>
                    <Td className="hidden lg:table-cell">
                      <div>{r.contactNo}</div>
                      <div className="text-xs text-slate-400">{r.email}</div>
                    </Td>
                    <Td className="hidden md:table-cell">{r.venue}</Td>
                    <Td className="hidden xl:table-cell max-w-xs truncate" title={r.equipmentRequested}>
                      {r.equipmentRequested}
                    </Td>
                    <Td>{r.items.length}</Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {(r.returnedAt ?? r.deniedAt) ? new Date((r.returnedAt ?? r.deniedAt) as number).toLocaleString() : '—'}
                    </Td>
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

function StatusBadge({ status }: { status: BorrowRequest['status'] }) {
  const label = status === 'denied' ? HISTORY_LOG_ACTION_LABELS.denied : HISTORY_LOG_ACTION_LABELS.returned;
  const color = status === 'denied' ? HISTORY_LOG_ACTION_COLORS.denied : HISTORY_LOG_ACTION_COLORS.returned;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '', title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <td className={`px-4 py-3 text-slate-700 ${className}`} title={title}>
      {children}
    </td>
  );
}
