import { useEffect, useMemo, useState } from 'react';
import { subscribeEquipment } from '../../lib/equipment';
import { createPullout, subscribePullouts } from '../../lib/equipmentPullouts';
import { useCurrentUser } from '../../lib/useCurrentUser';
import type { Equipment, EquipmentPullout } from '../../types';

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

  const resetForm = () => {
    setEquipmentId('');
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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Equipment Pullout</h1>

      <form onSubmit={handleSubmit} className="card p-4 space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Equipment Name</label>
          <select
            required
            className="input"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
          >
            <option value="" disabled>
              Select equipment...
            </option>
            {sortedEquipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.item} ({eq.inventoryCode})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Area</label>
          <input
            required
            className="input"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="e.g. Main Sanctuary, Youth Room"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date and Time of Pullout</label>
          <input
            required
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
          <div className="space-y-2 sm:hidden">
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
              </div>
            ))}
          </div>

          {/* Desktop / tablet table */}
          <div className="card p-0 overflow-x-auto hidden sm:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <Th>Equipment</Th>
                  <Th className="hidden md:table-cell">Inventory Code</Th>
                  <Th>Area</Th>
                  <Th>Date &amp; Time</Th>
                  <Th className="hidden lg:table-cell">Logged By</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td>{p.item}</Td>
                    <Td className="hidden md:table-cell font-mono text-xs">{p.inventoryCode}</Td>
                    <Td>{p.area}</Td>
                    <Td className="whitespace-nowrap">{new Date(p.pulloutAt).toLocaleString()}</Td>
                    <Td className="hidden lg:table-cell">{p.actor ?? '—'}</Td>
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
