import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeEquipment } from '../../lib/equipment';
import { useActiveMinistry } from '../../lib/MinistryContext';
import { EQUIPMENT_STATUSES } from '../../types';
import type { Equipment } from '../../types';

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

interface PurchaseRow {
  id: number;
  item: string;
  assignedTo: string;
  qty: string;
  reason: string;
}

function emptyPurchaseRow(id: number): PurchaseRow {
  return { id, item: '', assignedTo: '', qty: '', reason: '' };
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

export default function Report() {
  const { ministryId } = useActiveMinistry();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [section, setSection] = useState('Technology');
  const [category, setCategory] = useState('All');
  const [subcategory, setSubcategory] = useState('All');
  const nextRowId = useRef(1);
  const [purchaseRows, setPurchaseRows] = useState<PurchaseRow[]>([emptyPurchaseRow(0)]);
  const [highlightedDetails, setHighlightedDetails] = useState<Set<string>>(new Set());

  function toggleDetailHighlight(id: string) {
    setHighlightedDetails((prev) => toggleInSet(prev, id));
  }

  function updatePurchaseRow(id: number, field: keyof Omit<PurchaseRow, 'id'>, value: string) {
    setPurchaseRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addPurchaseRow() {
    setPurchaseRows((rows) => [...rows, emptyPurchaseRow(nextRowId.current++)]);
  }

  function removePurchaseRow(id: number) {
    setPurchaseRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }

  useEffect(() => {
    if (!ministryId) return;
    return subscribeEquipment(ministryId, setEquipment);
  }, [ministryId]);

  const categories = useMemo(
    () => Array.from(new Set(equipment.map((e) => e.category))).sort(),
    [equipment],
  );

  const subcategories = useMemo(
    () =>
      Array.from(
        new Set(
          equipment
            .filter((e) => category === 'All' || e.category === category)
            .map((e) => e.subcategory)
            .filter(Boolean),
        ),
      ).sort(),
    [equipment, category],
  );

  function handleCategoryChange(value: string) {
    setCategory(value);
    setSubcategory('All');
  }

  const filtered = useMemo(
    () =>
      equipment
        .filter((e) => category === 'All' || e.category === category)
        .filter((e) => subcategory === 'All' || e.subcategory === subcategory),
    [equipment, category, subcategory],
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.location.localeCompare(b.location) || a.item.localeCompare(b.item)),
    [filtered],
  );

  const summaryRows = useMemo(() => {
    const byItem = new Map<string, Record<string, number>>();
    for (const e of filtered) {
      const row = byItem.get(e.item) ?? {};
      row[e.status] = (row[e.status] ?? 0) + 1;
      byItem.set(e.item, row);
    }
    return Array.from(byItem.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([item, counts]) => ({
        item,
        counts,
        total: EQUIPMENT_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0),
      }));
  }, [filtered]);

  const grandTotal = summaryRows.reduce(
    (acc, row) => {
      EQUIPMENT_STATUSES.forEach((s) => {
        acc[s] = (acc[s] ?? 0) + (row.counts[s] ?? 0);
      });
      acc.total += row.total;
      return acc;
    },
    { total: 0 } as Record<string, number>,
  );

  return (
    <div className="space-y-4 print:space-y-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <h1 className="text-xl font-semibold text-slate-800">Generate Report</h1>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className="input w-auto" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
            <option value="All">All sub categories</option>
            {subcategories.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="btn-primary whitespace-nowrap" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="print:hidden">
        <label className="block max-w-xs">
          <span className="block text-sm font-medium text-slate-700 mb-1">Section</span>
          <input className="input" value={section} onChange={(e) => setSection(e.target.value)} />
        </label>
      </div>

      <div className="card space-y-3 print:space-y-1 print:shadow-none print:ring-0 print:p-0">
        <div className="flex items-baseline justify-between flex-wrap gap-1">
          <h2 className="text-lg font-bold text-slate-800 print:text-xs">EQUIPMENT INVENTORY DETAILS</h2>
          <span className="text-sm text-slate-500 print:text-[10px]">as of {today}</span>
        </div>
        <div className="flex flex-wrap gap-x-8 print:gap-x-3 gap-y-1 text-sm print:text-[10px]">
          <div>
            <span className="font-semibold text-slate-700">Section: </span>
            {section}
          </div>
          <div>
            <span className="font-semibold text-slate-700">Category: </span>
            {category}
          </div>
          <div>
            <span className="font-semibold text-slate-700">Sub Category: </span>
            {subcategory}
          </div>
        </div>

        <div className="overflow-x-auto pr-10 print:pr-0">
          <table className="min-w-full table-fixed text-xs sm:text-sm print:text-[10px] border border-slate-200">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <Th className="!whitespace-normal">Items</Th>
                <Th className="!whitespace-normal">Location</Th>
                <Th className="!whitespace-normal">Assigned to</Th>
                <Th className="!whitespace-normal">Role</Th>
                <Th className="!whitespace-normal">Purchase Date</Th>
                <Th className="!whitespace-normal">Status</Th>
                <Th className="!whitespace-normal">Recommendation</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr
                  key={e.id}
                  className={`relative border-t border-slate-200 ${
                    highlightedDetails.has(e.id) ? 'bg-orange-100 print:bg-orange-100' : ''
                  }`}
                >
                  <Td>{e.item}</Td>
                  <Td>{e.location || '—'}</Td>
                  <Td>{e.assignedTo || '—'}</Td>
                  <Td>{e.subcategory || '—'}</Td>
                  <Td>{e.purchaseDate ? e.purchaseDate.slice(0, 4) : '—'}</Td>
                  <Td>{e.status}</Td>
                  <Td>
                    {e.statusDetails || ''}
                    <HighlightButton
                      active={highlightedDetails.has(e.id)}
                      onClick={() => toggleDetailHighlight(e.id)}
                      className="absolute right-[-2rem] top-1/2 -translate-y-1/2 print:hidden"
                    />
                  </Td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-6">
                    No equipment found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card space-y-3 print:space-y-1 print:break-before-page print:shadow-none print:ring-0 print:p-0">
        <div className="flex items-baseline justify-between flex-wrap gap-1">
          <h2 className="text-lg font-bold text-slate-800 print:text-xs">EQUIPMENT INVENTORY SUMMARY</h2>
          <span className="text-sm text-slate-500 print:text-[10px]">as of {today}</span>
        </div>
        <div className="text-sm print:text-[10px] space-y-0.5">
          <div>
            <span className="font-semibold text-slate-700">Section: </span>
            {section}
          </div>
          <div>
            <span className="font-semibold text-slate-700">Category: </span>
            {category}
          </div>
          <div>
            <span className="font-semibold text-slate-700">Sub Category: </span>
            {subcategory}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm print:text-[10px] border border-slate-200">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <Th>Equipment Name</Th>
                {EQUIPMENT_STATUSES.map((s) => (
                  <Th key={s}>{s}</Th>
                ))}
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row) => (
                <tr key={row.item} className="border-t border-slate-200">
                  <Td>{row.item}</Td>
                  {EQUIPMENT_STATUSES.map((s) => (
                    <Td key={s} className="text-center">
                      {row.counts[s] ?? 0}
                    </Td>
                  ))}
                  <Td className="text-center font-semibold">{row.total}</Td>
                </tr>
              ))}
              {summaryRows.length === 0 && (
                <tr>
                  <td colSpan={EQUIPMENT_STATUSES.length + 2} className="text-center text-slate-400 py-6">
                    No equipment found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
            {summaryRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                  <Td>TOTAL</Td>
                  {EQUIPMENT_STATUSES.map((s) => (
                    <Td key={s} className="text-center">
                      {grandTotal[s] ?? 0}
                    </Td>
                  ))}
                  <Td className="text-center">{grandTotal.total}</Td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="card space-y-3 print:space-y-1 print:shadow-none print:ring-0 print:p-0">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <h2 className="text-lg font-bold text-slate-800 print:text-xs">Purchase Description</h2>
          <button className="btn-secondary print:hidden" onClick={addPurchaseRow} type="button">
            + Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm print:text-[10px] border border-slate-200">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <Th>Proposed Items</Th>
                <Th>Assigned to</Th>
                <Th>QTY</Th>
                <Th>Reason for Purchase/Repair</Th>
                <Th className="print:hidden"> </Th>
              </tr>
            </thead>
            <tbody>
              {purchaseRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <Td>
                    <PurchaseInput
                      value={row.item}
                      onChange={(v) => updatePurchaseRow(row.id, 'item', v)}
                      placeholder="e.g. TYT TH-UV 98"
                    />
                  </Td>
                  <Td>
                    <PurchaseInput
                      value={row.assignedTo}
                      onChange={(v) => updatePurchaseRow(row.id, 'assignedTo', v)}
                      placeholder="e.g. Housekeeping"
                    />
                  </Td>
                  <Td>
                    <PurchaseInput
                      value={row.qty}
                      onChange={(v) => updatePurchaseRow(row.id, 'qty', v)}
                      placeholder="0"
                      className="w-16"
                    />
                  </Td>
                  <Td>
                    <PurchaseInput
                      value={row.reason}
                      onChange={(v) => updatePurchaseRow(row.id, 'reason', v)}
                      placeholder="e.g. Faster communication"
                    />
                  </Td>
                  <Td className="print:hidden">
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => removePurchaseRow(row.id)}
                      aria-label="Remove row"
                    >
                      &times;
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-2 py-2 lg:px-3 text-left font-semibold whitespace-nowrap print:whitespace-normal print:px-1 print:py-0.5 print:text-[10px] ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-2 py-2 lg:px-3 text-slate-700 print:px-1 print:py-0.5 print:text-[10px] ${className}`}>
      {children}
    </td>
  );
}

function HighlightButton({
  active,
  onClick,
  className = '',
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${active ? 'text-orange-500 hover:text-orange-600' : 'text-slate-300 hover:text-orange-400'} ${className}`}
      aria-label={active ? 'Remove highlight' : 'Highlight row'}
      title={active ? 'Remove highlight' : 'Highlight row'}
    >
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l-4.5 4.5a1.5 1.5 0 01-2.121-2.121L7 9.5m2-2l4.086-4.086a2 2 0 012.828 0l.586.586a2 2 0 010 2.828L12.414 11m-3.5-3.5l3.5 3.5"
        />
      </svg>
    </button>
  );
}

function PurchaseInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      className={`w-full min-w-[6rem] rounded-lg border border-slate-200 px-2 py-1 text-inherit focus:outline-none focus:ring-2 focus:ring-primary-500 print:border-none print:p-0 print:ring-0 print:placeholder:text-transparent ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
