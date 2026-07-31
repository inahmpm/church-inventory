import { useEffect, useMemo, useState } from 'react';
import { subscribeEquipment } from '../../lib/equipment';
import { createPullout, deletePullout, subscribePullouts } from '../../lib/equipmentPullouts';
import { useCurrentUser } from '../../lib/useCurrentUser';
import type { Equipment, EquipmentPullout } from '../../types';

function IconPrinter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-2M6 14h12v7H6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M4 7h16M9 7V4h6v3m-8 0 1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EquipmentPulloutPage() {
  const { profile } = useCurrentUser();
  const ministryId = profile?.ministryId;

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [pullouts, setPullouts] = useState<EquipmentPullout[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(false);
  const [area, setArea] = useState('');
  const [pulloutAt, setPulloutAt] = useState(() => toDatetimeLocal(Date.now()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ministryId) return;
    return subscribeEquipment(ministryId, setEquipment);
  }, [ministryId]);

  useEffect(() => {
    if (!ministryId) return;
    return subscribePullouts(ministryId, setPullouts);
  }, [ministryId]);

  const sortedEquipment = useMemo(
    () => [...equipment].sort((a, b) => a.item.localeCompare(b.item)),
    [equipment],
  );

  const matchingEquipment = useMemo(() => {
    const term = equipmentSearch.trim().toLowerCase();
    if (!term) return sortedEquipment;
    return sortedEquipment.filter(
      (eq) => eq.item.toLowerCase().includes(term) || eq.inventoryCode.toLowerCase().includes(term),
    );
  }, [sortedEquipment, equipmentSearch]);

  const selectEquipment = (eq: Equipment) => {
    setEquipmentId(eq.id);
    setEquipmentSearch(`${eq.item} (${eq.inventoryCode})`);
    setEquipmentDropdownOpen(false);
  };

  const resetForm = () => {
    setEquipmentId('');
    setEquipmentSearch('');
    setArea('');
    setPulloutAt(toDatetimeLocal(Date.now()));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministryId) return;
    const equip = equipment.find((eq) => eq.id === equipmentId);
    if (!equip) {
      setError('Select an equipment item.');
      return;
    }
    if (!area.trim()) {
      setError('Enter the area.');
      return;
    }
    if (!pulloutAt || Number.isNaN(new Date(pulloutAt).getTime())) {
      setError('Enter the date and time of pullout.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await createPullout({
        ministryId,
        equipmentId: equip.id,
        inventoryCode: equip.inventoryCode,
        item: equip.item,
        area: area.trim(),
        pulloutAt: new Date(pulloutAt).getTime(),
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log pullout.');
    } finally {
      setSaving(false);
    }
  };

  const rows = [...pullouts].sort((a, b) => b.pulloutAt - a.pulloutAt);

  const handleDelete = async (p: EquipmentPullout) => {
    if (!confirm(`Delete the pullout log for "${p.item}" (${p.area})? This cannot be undone.`)) return;
    setError('');
    try {
      await deletePullout(p.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pullout log.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold text-slate-800">Equipment Pullout</h1>
        {rows.length > 0 && (
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5"
            onClick={() => window.print()}
            title="Print"
            aria-label="Print"
          >
            <IconPrinter />
            <span className="hidden md:inline">Print</span>
          </button>
        )}
      </div>
      <h1 className="hidden print:block text-xl font-semibold text-slate-800">Equipment Pullout</h1>

      <form onSubmit={handleSubmit} className="card p-4 space-y-4 max-w-xl print:hidden">
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">Equipment Name</label>
          <input
            className="input"
            value={equipmentSearch}
            onChange={(e) => {
              setEquipmentSearch(e.target.value);
              setEquipmentId('');
              setEquipmentDropdownOpen(true);
            }}
            onFocus={() => setEquipmentDropdownOpen(true)}
            onBlur={() => setTimeout(() => setEquipmentDropdownOpen(false), 150)}
            placeholder="Search equipment by name or code..."
            autoComplete="off"
          />
          {equipmentDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {matchingEquipment.length === 0 && (
                <div className="px-3 py-2 text-sm text-slate-400">No matching equipment.</div>
              )}
              {matchingEquipment.map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  className={`block w-full text-left px-3 py-2 text-sm hover:bg-slate-100 ${
                    eq.id === equipmentId ? 'bg-primary-50 text-primary-700' : 'text-slate-700'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectEquipment(eq)}
                >
                  {eq.item} <span className="text-slate-400 font-mono text-xs">({eq.inventoryCode})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Area</label>
          <input
            className="input"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="e.g. Main Sanctuary, Youth Room"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date and Time of Pullout</label>
          <input
            type="datetime-local"
            className="input"
            value={pulloutAt}
            onChange={(e) => setPulloutAt(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Logging...' : 'Log Pullout'}
        </button>
      </form>

      {rows.length === 0 && (
        <div className="card text-center text-slate-400 py-10">No equipment pullouts logged yet.</div>
      )}

      {rows.length > 0 && (
        <>
          {/* Mobile card list */}
          <div className="space-y-2 sm:hidden print:hidden">
            {rows.map((p) => (
              <div key={p.id} className="card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{p.item}</span>
                  <span className="text-xs text-slate-400 font-mono">{p.inventoryCode}</span>
                </div>
                <div className="text-xs text-slate-500">Area: {p.area}</div>
                <div className="text-xs text-slate-500">
                  Pulled out: {new Date(p.pulloutAt).toLocaleString()}
                </div>
                {p.actor && <div className="text-xs text-slate-400">By: {p.actor}</div>}
                <div className="pt-1 print:hidden">
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(p)}
                    title="Delete"
                    aria-label="Delete"
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop / tablet table */}
          <div className="card p-0 overflow-x-auto hidden sm:block print:block print:shadow-none print:ring-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <Th>Equipment</Th>
                  <Th className="hidden md:table-cell print:table-cell">Inventory Code</Th>
                  <Th>Area</Th>
                  <Th>Date &amp; Time</Th>
                  <Th className="hidden lg:table-cell print:table-cell">Logged By</Th>
                  <Th className="print:hidden">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td>{p.item}</Td>
                    <Td className="hidden md:table-cell print:table-cell font-mono text-xs">{p.inventoryCode}</Td>
                    <Td>{p.area}</Td>
                    <Td className="whitespace-nowrap">{new Date(p.pulloutAt).toLocaleString()}</Td>
                    <Td className="hidden lg:table-cell print:table-cell">{p.actor ?? '—'}</Td>
                    <Td className="print:hidden">
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(p)}
                        title="Delete"
                        aria-label="Delete"
                      >
                        <IconTrash />
                      </button>
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

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-700 ${className}`}>{children}</td>;
}
