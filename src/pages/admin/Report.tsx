import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeEquipment } from '../../lib/equipment';
import { subscribeCategories } from '../../lib/categories';
import { useActiveMinistry } from '../../lib/MinistryContext';
import { EQUIPMENT_STATUSES, customFieldColumns, customFieldValue } from '../../types';
import type { Category, Equipment, EquipmentStatus } from '../../types';
import ColumnPickerButton from '../../components/ColumnPickerButton';
import { useColumnVisibility } from '../../lib/useColumnVisibility';

const DETAIL_COLUMNS: { id: string; label: string; widthClass: string }[] = [
  { id: 'status', label: 'Status', widthClass: 'print:w-[5%]' },
  { id: 'item', label: 'Items', widthClass: 'print:w-[17%]' },
  { id: 'location', label: 'Location', widthClass: 'print:w-[12%]' },
  { id: 'assignedTo', label: 'Assigned to', widthClass: 'print:w-[15%]' },
  { id: 'role', label: 'Role', widthClass: 'print:w-[9%]' },
  { id: 'purchaseDate', label: 'Purchase Date', widthClass: 'print:w-[10%]' },
];

const STATUS_DOT_COLORS: Record<EquipmentStatus, string> = {
  'Good Condition': 'bg-green-500',
  'Fair Condition': 'bg-yellow-400',
  'For Repair': 'bg-orange-500',
  'For Replacement': 'bg-purple-500',
  'For Disposal': 'bg-red-500',
};

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// Tailwind's JIT scanner needs literal class strings, so widths for a
// variable number of custom field columns are picked from this fixed list
// rather than built with a template string.
const CUSTOM_FIELD_COL_WIDTHS = ['print:w-[20%]', 'print:w-[10%]', 'print:w-[7%]', 'print:w-[5%]'];
function customFieldColWidthClass(count: number) {
  return CUSTOM_FIELD_COL_WIDTHS[Math.min(count, CUSTOM_FIELD_COL_WIDTHS.length) - 1] ?? 'print:w-[4%]';
}

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
  const [categoryDefs, setCategoryDefs] = useState<Category[]>([]);
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
  useEffect(() => {
    if (!ministryId) return;
    return subscribeCategories(ministryId, setCategoryDefs);
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

  const customCols = useMemo(() => customFieldColumns(categoryDefs), [categoryDefs]);

  const { isVisible: isColumnVisible, toggle: toggleColumn, showAll: showAllColumns } = useColumnVisibility(
    'report-columns',
  );

  const columnPickerOptions = useMemo(
    () => [
      ...DETAIL_COLUMNS.map((col) => ({ id: col.id, label: col.label })),
      ...customCols.map((col) => ({ id: col.id, label: col.name })),
      { id: 'notes', label: 'Notes' },
    ],
    [customCols],
  );

  const visibleDetailColumns = useMemo(
    () => DETAIL_COLUMNS.filter((col) => isColumnVisible(col.id)),
    [isColumnVisible],
  );
  const visibleCustomCols = useMemo(
    () => customCols.filter((col) => isColumnVisible(col.id)),
    [customCols, isColumnVisible],
  );
  const notesVisible = isColumnVisible('notes');
  const totalDetailColumns = visibleDetailColumns.length + visibleCustomCols.length + (notesVisible ? 1 : 0);

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
          <ColumnPickerButton
            columns={columnPickerOptions}
            isVisible={isColumnVisible}
            onToggle={toggleColumn}
            onShowAll={showAllColumns}
          />
          <button className="btn-primary whitespace-nowrap" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <StatusLegend />
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

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full table-auto print:table-fixed text-xs sm:text-sm print:text-[10px] border border-slate-200">
            <colgroup>
              {visibleDetailColumns.map((col) => (
                <col key={col.id} className={col.widthClass} />
              ))}
              {visibleCustomCols.map((col) => (
                <col key={col.id} className={customFieldColWidthClass(visibleCustomCols.length)} />
              ))}
              {notesVisible && <col className="print:w-auto" />}
            </colgroup>
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {visibleDetailColumns.map((col) => (
                  <Th
                    key={col.id}
                    className={col.id === 'status' ? '!whitespace-normal text-center' : 'text-center print:!whitespace-normal'}
                  >
                    {col.label}
                  </Th>
                ))}
                {visibleCustomCols.map((col) => (
                  <Th key={col.id} className="text-center print:!whitespace-normal">
                    {col.name}
                  </Th>
                ))}
                {notesVisible && <Th className="!whitespace-normal text-center w-full print:w-auto">Notes</Th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr
                  key={e.id}
                  className={`border-t border-slate-200 ${
                    highlightedDetails.has(e.id) ? 'bg-sky-100 print:bg-sky-100' : ''
                  }`}
                >
                  {visibleDetailColumns.map((col) => (
                    <Td key={col.id} className="text-center whitespace-nowrap print:whitespace-normal print:break-words">
                      {detailCellContent(e, col.id)}
                    </Td>
                  ))}
                  {visibleCustomCols.map((col) => (
                    <Td key={col.id} className="text-center whitespace-nowrap print:whitespace-normal print:break-words">
                      {customFieldValue(e, categoryDefs, col)}
                    </Td>
                  ))}
                  {notesVisible && (
                    <Td className="relative text-center pr-6 print:pr-1 w-full print:w-auto">
                      <span className="block max-w-[16rem] break-words print:max-w-none mx-auto">{e.statusDetails || ''}</span>
                      <HighlightButton
                        active={highlightedDetails.has(e.id)}
                        onClick={() => toggleDetailHighlight(e.id)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 print:hidden"
                      />
                    </Td>
                  )}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={totalDetailColumns} className="text-center text-slate-400 py-6">
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
                    <AutoGrowTextarea
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

function detailCellContent(e: Equipment, columnId: string) {
  switch (columnId) {
    case 'status':
      return <StatusDot status={e.status} />;
    case 'item':
      return e.item;
    case 'location':
      return e.location || '—';
    case 'assignedTo':
      return e.assignedTo || '—';
    case 'role':
      return e.subcategory || '—';
    case 'purchaseDate':
      return e.purchaseDate ? e.purchaseDate.slice(0, 4) : '—';
    default:
      return null;
  }
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
    <td className={`px-2 py-2 lg:px-3 align-top text-slate-700 print:px-1 print:py-0.5 print:text-[10px] ${className}`}>
      {children}
    </td>
  );
}

function StatusDot({ status }: { status: EquipmentStatus }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full print:h-2 print:w-2 ${STATUS_DOT_COLORS[status]}`}
      title={status}
    >
      <span className="sr-only">{status}</span>
    </span>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 print:text-[9px] print:px-2 print:py-1">
      {EQUIPMENT_STATUSES.map((status) => (
        <span key={status} className="flex items-center gap-1 whitespace-nowrap">
          <span className={`inline-block h-2.5 w-2.5 rounded-full print:h-2 print:w-2 ${STATUS_DOT_COLORS[status]}`} />
          {status}
        </span>
      ))}
    </div>
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
      className={`${active ? 'text-sky-500 hover:text-sky-600' : 'text-slate-300 hover:text-sky-400'} ${className}`}
      aria-label={active ? 'Remove highlight' : 'Highlight row'}
      title={active ? 'Remove highlight' : 'Highlight row'}
    >
      <svg viewBox="0 0 20 20" className="w-3 h-3" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l-4.5 4.5a1.5 1.5 0 01-2.121-2.121L7 9.5m2-2l4.086-4.086a2 2 0 012.828 0l.586.586a2 2 0 010 2.828L12.414 11m-3.5-3.5l3.5 3.5"
        />
      </svg>
    </button>
  );
}

function AutoGrowTextarea({
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
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    resize(ref.current);
  }, [value]);

  return (
    <textarea
      ref={ref}
      className={`w-full min-w-[6rem] resize-none overflow-hidden rounded-lg border border-slate-200 px-2 py-1 text-inherit leading-snug focus:outline-none focus:ring-2 focus:ring-primary-500 print:border-none print:p-0 print:ring-0 print:placeholder:text-transparent ${className}`}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        resize(e.target);
      }}
      placeholder={placeholder}
      rows={1}
    />
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
