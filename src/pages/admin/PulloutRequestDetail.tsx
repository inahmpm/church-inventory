import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { subscribeEquipment } from '../../lib/equipment';
import { attachItems, removeAttachedItem, subscribePulloutItems, subscribePulloutRequest } from '../../lib/pulloutRequests';
import { useCurrentUser } from '../../lib/useCurrentUser';
import type { Equipment, PulloutItem, PulloutRequest } from '../../types';

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

export default function PulloutRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useCurrentUser();
  const ministryId = profile?.ministryId;

  const [request, setRequest] = useState<PulloutRequest | null | undefined>(undefined);
  const [items, setItems] = useState<PulloutItem[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);

  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(false);
  const [pending, setPending] = useState<Equipment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    return subscribePulloutRequest(id, setRequest);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribePulloutItems(id, setItems);
  }, [id]);

  useEffect(() => {
    if (!ministryId) return;
    return subscribeEquipment(ministryId, setEquipment);
  }, [ministryId]);

  const sortedEquipment = useMemo(
    () =>
      [...equipment].sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.subcategory.localeCompare(b.subcategory) ||
          a.item.localeCompare(b.item),
      ),
    [equipment],
  );

  const availableEquipment = useMemo(
    () => sortedEquipment.filter((eq) => !eq.isBorrowed && !eq.pulloutStatus),
    [sortedEquipment],
  );

  const matchesSearchTerm = (eq: Equipment, term: string) =>
    eq.item.toLowerCase().includes(term) || eq.inventoryCode.toLowerCase().includes(term);

  const matchingEquipment = useMemo(() => {
    const pendingIds = new Set(pending.map((eq) => eq.id));
    const term = equipmentSearch.trim().toLowerCase();
    const pool = availableEquipment.filter((eq) => !pendingIds.has(eq.id));
    if (!term) return pool;
    return pool.filter((eq) => matchesSearchTerm(eq, term));
  }, [availableEquipment, equipmentSearch, pending]);

  const unavailableMatchCount = useMemo(() => {
    const term = equipmentSearch.trim().toLowerCase();
    if (!term) return 0;
    return sortedEquipment.filter((eq) => (eq.isBorrowed || eq.pulloutStatus) && matchesSearchTerm(eq, term)).length;
  }, [sortedEquipment, equipmentSearch]);

  const canEditItems = request?.status === 'draft' || request?.status === 'scheduled';

  function handleAddPending(eq: Equipment) {
    setEquipmentSearch('');
    setEquipmentDropdownOpen(false);
    setPending((prev) => (prev.some((p) => p.id === eq.id) ? prev : [...prev, eq]));
  }

  function handleRemovePending(eq: Equipment) {
    setPending((prev) => prev.filter((p) => p.id !== eq.id));
  }

  async function handleSave() {
    if (!request || !ministryId || pending.length === 0) return;
    setError('');
    setSaving(true);
    try {
      await attachItems(request.id, ministryId, pending.map((eq) => eq.id));
      setPending([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save items.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(item: PulloutItem) {
    if (!request || !ministryId) return;
    setError('');
    try {
      await removeAttachedItem(request.id, ministryId, item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item.');
    }
  }

  if (request === undefined) {
    return <div className="text-slate-500">Loading...</div>;
  }
  if (request === null) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500">Pull-out request not found.</p>
        <button className="text-primary-600 hover:underline text-sm" onClick={() => navigate(-1)}>
          &larr; Back to Pull-out Requests
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <button className="text-primary-600 hover:underline text-sm mb-2 print:hidden" onClick={() => navigate(-1)}>
            &larr; Back to Pull-out Requests
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-800">{request.purpose}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[request.status]} print:hidden`}>
              {STATUS_LABELS[request.status]}
            </span>
          </div>
          <div className="text-sm text-slate-500 mt-1 space-y-0.5">
            <div>Destination: {request.destination}</div>
            <div>
              Pull-out: {new Date(request.pulloutAt).toLocaleString()} &middot; Return due:{' '}
              {new Date(request.returnDueAt).toLocaleString()}
            </div>
            <div>
              Requestor: {request.requestorName}
              {request.requestorEmail ? ` (${request.requestorEmail})` : ''}
            </div>
          </div>
        </div>
        <button className="btn-secondary print:hidden" onClick={() => window.print()}>
          Print
        </button>
      </div>

      {error && <p className="text-sm text-red-600 print:hidden">{error}</p>}

      {canEditItems && (
        <div className="card p-4 space-y-3 max-w-xl print:hidden">
          <h2 className="font-medium text-slate-800">Attach Equipment</h2>
          <div className="relative">
            <input
              className="input"
              value={equipmentSearch}
              onChange={(e) => {
                setEquipmentSearch(e.target.value);
                setEquipmentDropdownOpen(true);
              }}
              onFocus={() => setEquipmentDropdownOpen(true)}
              onBlur={() => setTimeout(() => setEquipmentDropdownOpen(false), 150)}
              placeholder="Search equipment by name or code..."
              autoComplete="off"
              disabled={saving}
            />
            {equipmentDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {matchingEquipment.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400">
                    {unavailableMatchCount > 0
                      ? `${unavailableMatchCount} matching item${unavailableMatchCount === 1 ? '' : 's'} found, but already borrowed or attached to a pull-out request.`
                      : 'No matching equipment available.'}
                  </div>
                )}
                {matchingEquipment.map((eq) => (
                  <button
                    key={eq.id}
                    type="button"
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100 text-slate-700"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAddPending(eq)}
                  >
                    {eq.item} <span className="text-slate-400 font-mono text-xs">({eq.inventoryCode})</span>
                    <div className="text-xs text-slate-400">
                      {eq.category}
                      {eq.subcategory ? ` / ${eq.subcategory}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {pending.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                To be attached ({pending.length})
              </h3>
              <ul className="divide-y divide-slate-100">
                {pending.map((eq) => (
                  <li key={eq.id} className="py-2 flex justify-between items-center text-sm">
                    <span>
                      <span className="font-mono text-slate-500">{eq.inventoryCode}</span> — {eq.item}
                      <span className="text-slate-400">
                        {' '}
                        ({eq.category}
                        {eq.subcategory ? ` / ${eq.subcategory}` : ''})
                      </span>
                    </span>
                    <button
                      className="text-red-600 hover:underline text-xs"
                      onClick={() => handleRemovePending(eq)}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button className="btn-primary" disabled={pending.length === 0 || saving} onClick={handleSave}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">Items ({items.length})</h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No items attached yet.</p>
        ) : (
          <div className="card p-0 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <Th>Item</Th>
                  <Th>Category</Th>
                  <Th>Code</Th>
                  <Th>Status</Th>
                  <Th className="hidden md:table-cell">Scanned Out</Th>
                  <Th className="hidden md:table-cell">Scanned In</Th>
                  <Th className="print:hidden"></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <Td>{item.item}</Td>
                    <Td className="text-xs text-slate-500">
                      {item.category}
                      {item.subcategory ? ` / ${item.subcategory}` : ''}
                    </Td>
                    <Td className="font-mono text-xs">{item.inventoryCode}</Td>
                    <Td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ITEM_STATUS_COLORS[item.itemStatus]}`}>
                        {ITEM_STATUS_LABELS[item.itemStatus]}
                      </span>
                      {item.conditionNoteOnReturn && (
                        <div className="text-xs text-slate-400 mt-0.5">{item.conditionNoteOnReturn}</div>
                      )}
                    </Td>
                    <Td className="hidden md:table-cell text-xs text-slate-500">
                      {item.scannedOutAt ? new Date(item.scannedOutAt).toLocaleString() : '—'}
                    </Td>
                    <Td className="hidden md:table-cell text-xs text-slate-500">
                      {item.scannedInAt ? new Date(item.scannedInAt).toLocaleString() : '—'}
                    </Td>
                    <Td className="print:hidden">
                      {canEditItems && item.itemStatus === 'for_pullout' && (
                        <button className="text-red-600 hover:underline text-xs" onClick={() => handleRemove(item)}>
                          Remove
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
