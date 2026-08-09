import { useEffect, useMemo, useState } from 'react';
import { subscribeEquipment } from '../../lib/equipment';
import { subscribeBorrowRequests } from '../../lib/borrowRequests';
import { useActiveMinistry } from '../../lib/MinistryContext';
import type { BorrowRequest, Equipment } from '../../types';
import { EQUIPMENT_STATUSES } from '../../types';

export default function Dashboard() {
  const { ministryId } = useActiveMinistry();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [pending, setPending] = useState<BorrowRequest[]>([]);
  const [active, setActive] = useState<BorrowRequest[]>([]);
  const [subCategoryFilter, setSubCategoryFilter] = useState('');

  useEffect(() => {
    if (!ministryId) return;
    return subscribeEquipment(ministryId, setEquipment);
  }, [ministryId]);
  useEffect(() => {
    if (!ministryId) return;
    return subscribeBorrowRequests(['pending'], setPending, ministryId);
  }, [ministryId]);
  useEffect(() => {
    if (!ministryId) return;
    return subscribeBorrowRequests(['borrowed'], setActive, ministryId);
  }, [ministryId]);

  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of EQUIPMENT_STATUSES) map.set(s, 0);
    for (const e of equipment) map.set(e.status, (map.get(e.status) ?? 0) + 1);
    return map;
  }, [equipment]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of equipment) map.set(e.category, (map.get(e.category) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [equipment]);

  const bySubCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of equipment) {
      if (e.category !== subCategoryFilter) continue;
      map.set(e.subcategory, (map.get(e.subcategory) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [equipment, subCategoryFilter]);

  const borrowedCount = equipment.filter((e) => e.isBorrowed).length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Equipment" value={equipment.length} />
        <StatCard label="Currently Borrowed" value={borrowedCount} accent="text-amber-600" />
        <StatCard label="Pending Requests" value={pending.length} accent="text-primary-600" />
        <StatCard label="Active Borrows" value={active.length} accent="text-blue-600" />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-4">Equipment by Status</h2>
          <div className="space-y-2">
            {EQUIPMENT_STATUSES.map((status) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 w-36 shrink-0">{status}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${statusColor(status)}`}
                    style={{
                      width: equipment.length
                        ? `${((byStatus.get(status) ?? 0) / equipment.length) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-slate-700 w-6 text-right">
                  {byStatus.get(status) ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-4">Equipment by Category</h2>
          {byCategory.length === 0 && <p className="text-sm text-slate-400">No equipment yet.</p>}
          <div className="space-y-2">
            {byCategory.map(([category, count]) => (
              <div key={category} className="flex justify-between text-sm">
                <span className="text-slate-600">{category}</span>
                <span className="font-medium text-slate-800">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-4">Equipment by Sub-Category</h2>
          <select
            className="input mb-4"
            value={subCategoryFilter}
            onChange={(e) => setSubCategoryFilter(e.target.value)}
          >
            <option value="">Select a category…</option>
            {byCategory.map(([category]) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {!subCategoryFilter && (
            <p className="text-sm text-slate-400">Choose a category to see its sub-categories.</p>
          )}
          {subCategoryFilter && bySubCategory.length === 0 && (
            <p className="text-sm text-slate-400">No equipment in this category.</p>
          )}
          <div className="space-y-2">
            {bySubCategory.map(([subcategory, count]) => (
              <div key={subcategory} className="flex justify-between text-sm">
                <span className="text-slate-600">{subcategory}</span>
                <span className="font-medium text-slate-800">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-3">Latest Pending Requests</h2>
          <ul className="divide-y divide-slate-100">
            {pending.slice(0, 5).map((r) => (
              <li key={r.id} className="py-2 text-sm flex justify-between">
                <span className="text-slate-700">
                  {r.name} <span className="text-slate-400">— {r.ministry}</span>
                </span>
                <span className="text-slate-400">{new Date(r.submittedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${accent ?? 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

function statusColor(status: string) {
  switch (status) {
    case 'Good Condition':
      return 'bg-green-500';
    case 'Fair Condition':
      return 'bg-lime-500';
    case 'For Repair':
      return 'bg-amber-500';
    case 'For Replacement':
      return 'bg-orange-500';
    case 'For Disposal':
      return 'bg-red-500';
    default:
      return 'bg-slate-400';
  }
}
