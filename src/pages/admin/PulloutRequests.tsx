import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  markItemFound,
  markItemMissing,
  scanItemIn,
  scanItemOut,
  subscribePulloutItems,
  subscribePulloutRequests,
} from '../../lib/pulloutRequests';
import { useCurrentUser } from '../../lib/useCurrentUser';
import type { PulloutItem, PulloutRequest } from '../../types';
import QrCodeScanner from '../../components/QrCodeScanner';

const STATUS_LABELS: Record<PulloutRequest['status'], string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  closed: 'Closed',
};
const STATUS_COLORS: Record<PulloutRequest['status'], string> = {
  draft: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-amber-100 text-amber-700',
  closed: 'bg-green-100 text-green-700',
};

const ITEM_STATUS_LABELS: Record<PulloutItem['itemStatus'], string> = {
  for_pullout: 'For pull-out',
  pulled_out: 'Pulled out',
  returned: 'Returned',
  missing: 'Missing',
};
const ITEM_STATUS_COLORS: Record<PulloutItem['itemStatus'], string> = {
  for_pullout: 'bg-slate-100 text-slate-600',
  pulled_out: 'bg-amber-100 text-amber-700',
  returned: 'bg-green-100 text-green-700',
  missing: 'bg-red-100 text-red-700',
};

type Tab = 'due' | 'all';

function isDueOrOverdue(r: PulloutRequest): boolean {
  return r.pulloutAt <= Date.now() && (r.status === 'scheduled' || r.status === 'in_progress');
}

// Draft requests have no items to act on yet; every other status can still
// have a scan pending or a missing item waiting to be resolved.
const OPENABLE_STATUSES: PulloutRequest['status'][] = ['scheduled', 'in_progress', 'closed'];

export default function PulloutRequests() {
  const { profile } = useCurrentUser();
  const ministryId = profile?.ministryId;
  const navigate = useNavigate();

  const [requests, setRequests] = useState<PulloutRequest[]>([]);
  const [tab, setTab] = useState<Tab>('due');
  const [scanning, setScanning] = useState<PulloutRequest | null>(null);

  useEffect(() => {
    if (!ministryId) return;
    return subscribePulloutRequests(ministryId, setRequests);
  }, [ministryId]);

  // Keep the open scan panel in sync with live updates (e.g. status rollups).
  useEffect(() => {
    if (!scanning) return;
    const fresh = requests.find((r) => r.id === scanning.id);
    if (fresh) setScanning(fresh);
    else setScanning(null);
  }, [requests, scanning?.id]);

  const rows = useMemo(() => {
    const sorted = [...requests].sort((a, b) => a.pulloutAt - b.pulloutAt);
    return tab === 'due' ? sorted.filter(isDueOrOverdue) : sorted;
  }, [requests, tab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold text-slate-800">Equipment Pull-out</h1>
        <div className="flex items-center gap-3">
          <Link to="/admin/pullout/legacy" className="text-xs text-slate-400 hover:underline">
            Legacy log
          </Link>
          <button className="btn-primary" onClick={() => navigate('/admin/pullout/new')}>
            New Pull-out Request
          </button>
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
        <button
          type="button"
          className={`px-3 py-1.5 ${tab === 'due' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600'}`}
          onClick={() => setTab('due')}
        >
          Due Today
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 ${tab === 'all' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600'}`}
          onClick={() => setTab('all')}
        >
          All Requests
        </button>
      </div>

      {/* Mobile card list */}
      <div className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <div key={r.id} className="card p-3 space-y-1">
            <Link to={`/admin/pullout/${r.id}`} className="block space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">{r.purpose}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </div>
              <div className="text-xs text-slate-500">{r.destination}</div>
              <div className="text-xs text-slate-500">Pull-out: {new Date(r.pulloutAt).toLocaleString()}</div>
              <div className="text-xs text-slate-400">{r.itemCount} item(s)</div>
            </Link>
            {OPENABLE_STATUSES.includes(r.status) && (
              <button className="text-primary-600 hover:underline text-xs pt-1" onClick={() => setScanning(r)}>
                {r.status === 'closed' ? 'Resolve missing' : 'Scan'}
              </button>
            )}
          </div>
        ))}
        {rows.length === 0 && <div className="text-center text-slate-400 py-8">No pull-out requests here.</div>}
      </div>

      {/* Desktop / tablet table */}
      <div className="card p-0 overflow-x-auto hidden sm:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <Th>Purpose</Th>
              <Th className="hidden md:table-cell">Destination</Th>
              <Th>Pull-out</Th>
              <Th className="hidden lg:table-cell">Return Due</Th>
              <Th>Items</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/admin/pullout/${r.id}`)}>
                <Td>{r.purpose}</Td>
                <Td className="hidden md:table-cell">{r.destination}</Td>
                <Td className="whitespace-nowrap">{new Date(r.pulloutAt).toLocaleString()}</Td>
                <Td className="hidden lg:table-cell whitespace-nowrap">{new Date(r.returnDueAt).toLocaleString()}</Td>
                <Td>{r.itemCount}</Td>
                <Td>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </Td>
                <Td>
                  {OPENABLE_STATUSES.includes(r.status) && (
                    <button
                      className="text-primary-600 hover:underline text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScanning(r);
                      }}
                    >
                      {r.status === 'closed' ? 'Resolve missing' : 'Scan'}
                    </button>
                  )}
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 py-8">
                  No pull-out requests here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {scanning && <ScanPanel request={scanning} onClose={() => setScanning(null)} />}
    </div>
  );
}

function ScanPanel({ request, onClose }: { request: PulloutRequest; onClose: () => void }) {
  const { profile } = useCurrentUser();
  const [items, setItems] = useState<PulloutItem[]>([]);
  const [mode, setMode] = useState<'out' | 'in'>(request.status === 'in_progress' ? 'in' : 'out');
  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  useEffect(() => subscribePulloutItems(request.id, setItems), [request.id]);

  const forPulloutCount = items.filter((i) => i.itemStatus === 'for_pullout').length;
  const pulledOutCount = items.filter((i) => i.itemStatus === 'pulled_out').length;

  async function handleScan(code: string) {
    setError(null);
    try {
      if (mode === 'out') {
        await scanItemOut(request.id, code, profile?.email ?? null);
      } else {
        await scanItemIn(request.id, code, profile?.email ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process scan.');
    }
  }

  async function handleReportMissing(item: PulloutItem) {
    const note = prompt(`Report "${item.item}" (${item.inventoryCode}) as missing. Optional note:`);
    if (note === null) return;
    setBusyItemId(item.id);
    setError(null);
    try {
      await markItemMissing(request.id, request.ministryId, item.id, note.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report item missing.');
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleMarkFound(item: PulloutItem) {
    setBusyItemId(item.id);
    setError(null);
    try {
      await markItemFound(request.id, request.ministryId, item.id, profile?.email ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark item as found.');
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="card max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="font-semibold text-slate-800 text-lg">{request.purpose}</h2>
          <p className="text-sm text-slate-500">
            {request.destination} &middot; Pull-out {new Date(request.pulloutAt).toLocaleString()}
          </p>
        </div>

        {request.status !== 'closed' && (
          <>
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
              <button
                type="button"
                className={`px-3 py-1.5 ${mode === 'out' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600'}`}
                onClick={() => setMode('out')}
              >
                Scan Out ({forPulloutCount} left)
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 ${mode === 'in' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600'}`}
                onClick={() => setMode('in')}
              >
                Scan In ({pulledOutCount} left)
              </button>
            </div>

            <QrCodeScanner onScan={handleScan} />
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-2">Items ({items.length})</h3>
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="py-2 flex justify-between items-center text-sm">
                <span>
                  <span className="font-mono text-slate-500">{item.inventoryCode}</span> — {item.item}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${ITEM_STATUS_COLORS[item.itemStatus]}`}>
                    {ITEM_STATUS_LABELS[item.itemStatus]}
                  </span>
                </span>
                {request.status === 'in_progress' && item.itemStatus === 'pulled_out' && (
                  <button
                    className="text-red-600 hover:underline text-xs disabled:opacity-50"
                    disabled={busyItemId === item.id}
                    onClick={() => handleReportMissing(item)}
                  >
                    Report missing
                  </button>
                )}
                {item.itemStatus === 'missing' && (
                  <button
                    className="text-green-600 hover:underline text-xs disabled:opacity-50"
                    disabled={busyItemId === item.id}
                    onClick={() => handleMarkFound(item)}
                  >
                    {busyItemId === item.id ? 'Saving...' : 'Mark as found'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end pt-2">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-700 ${className}`}>{children}</td>;
}
