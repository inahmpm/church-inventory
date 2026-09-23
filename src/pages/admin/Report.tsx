import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { subscribeEquipment, updateEquipmentCustomField, updateEquipmentRemarks } from '../../lib/equipment';
import { subscribeCategories } from '../../lib/categories';
import { useActiveMinistry } from '../../lib/MinistryContext';
import {
  EQUIPMENT_STATUSES,
  customFieldColumns,
  customFieldDefFor,
  customFieldHeaderLabel,
  customFieldValue,
  departmentAlias,
  departmentSortKey,
} from '../../types';
import type { Category, CustomFieldDefinition, Equipment, EquipmentStatus } from '../../types';
import ColumnPickerButton, { type ColumnPickerOption } from '../../components/ColumnPickerButton';
import SortButton from '../../components/SortButton';
import MultiSelectDropdown from '../../components/MultiSelectDropdown';
import { useColumnVisibility } from '../../lib/useColumnVisibility';
import { useColumnOrder } from '../../lib/useColumnOrder';
import { formatDate } from '../../lib/date';

// `weight` is the relative share of print table width a column gets. Widths
// are recomputed from whichever columns are actually visible (see
// `useColumnWidths` below) so the print layout always fills 100% regardless
// of how many optional columns are toggled on.
const DETAIL_COLUMNS: { id: string; label: string; weight: number }[] = [
  { id: 'status', label: 'Status', weight: 5 },
  { id: 'subcategory', label: 'Sub Category', weight: 9 },
  { id: 'item', label: 'Items', weight: 20 },
  { id: 'location', label: 'Location', weight: 8 },
  { id: 'area', label: 'Area', weight: 12 },
  { id: 'assignedTo', label: 'Assigned to', weight: 19 },
  { id: 'purchaseDate', label: 'Purchase Date', weight: 10 },
];

// Additional Equipment Inventory columns, available via the Columns picker but
// hidden by default so the report's default layout stays unchanged.
const EXTRA_DETAIL_COLUMNS: { id: string; label: string; weight: number }[] = [
  { id: 'category', label: 'Category', weight: 9 },
  { id: 'inventoryCode', label: 'Inventory Code', weight: 10 },
  { id: 'serialNumber', label: 'Serial Number', weight: 10 },
  { id: 'assignedType', label: 'Assigned Type', weight: 9 },
  { id: 'department', label: 'Dept', weight: 7 },
  { id: 'ministry', label: 'Ministry', weight: 10 },
  { id: 'availability', label: 'Availability', weight: 9 },
];

const ALL_DETAIL_COLUMNS = [...DETAIL_COLUMNS, ...EXTRA_DETAIL_COLUMNS];
const EXTRA_DETAIL_COLUMN_IDS = EXTRA_DETAIL_COLUMNS.map((col) => col.id);
const CUSTOM_FIELD_COL_WEIGHT = 10;
const NOTES_COL_WEIGHT = 20;
const REMARKS_COL_WEIGHT = 20;

const STATUS_DOT_COLORS: Record<EquipmentStatus, string> = {
  'Good Condition': 'bg-green-500',
  'Fair Condition': 'bg-yellow-400',
  'For Repair': 'bg-orange-500',
  'For Replacement': 'bg-purple-500',
  'For Disposal': 'bg-red-500',
};

const today = formatDate(new Date());

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

function IconFilter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M4 5h16l-6 7v6l-4 2v-8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Report() {
  const { ministryId, ministry } = useActiveMinistry();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categoryDefs, setCategoryDefs] = useState<Category[]>([]);
  const [section, setSection] = useState(ministry?.name ?? 'Technology');
  const [category, setCategory] = useState('All');
  const [subcategory, setSubcategory] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState<string[]>([]);
  const [assignedToFilter, setAssignedToFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState('location');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const filterRef = useRef<HTMLDivElement>(null);
  const nextRowId = useRef(1);
  const [purchaseRows, setPurchaseRows] = useState<PurchaseRow[]>([emptyPurchaseRow(0)]);
  const [highlightedDetails, setHighlightedDetails] = useState<Set<string>>(new Set());
  const [remarksDrafts, setRemarksDrafts] = useState<Record<string, string>>({});
  // Keyed by `${equipmentId}:${customFieldDefId}`.
  const [customFieldDrafts, setCustomFieldDrafts] = useState<Record<string, string>>({});
  const detailRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const [detailRowHeight, setDetailRowHeight] = useState<number | null>(null);

  useEffect(() => {
    setSection(ministry?.name ?? 'Technology');
  }, [ministry?.name]);

  function toggleDetailHighlight(id: string) {
    setHighlightedDetails((prev) => toggleInSet(prev, id));
  }

  function handleRemarksChange(id: string, value: string) {
    setRemarksDrafts((prev) => ({ ...prev, [id]: value }));
  }

  async function handleRemarksBlur(e: Equipment) {
    const draft = remarksDrafts[e.id];
    if (draft === undefined || draft === e.remarks) return;
    try {
      await updateEquipmentRemarks(e.id, draft);
    } catch (err) {
      console.error('Failed to update remarks', err);
    }
  }

  function handleCustomFieldChange(equipmentId: string, defId: string, value: string) {
    setCustomFieldDrafts((prev) => ({ ...prev, [`${equipmentId}:${defId}`]: value }));
  }

  async function handleCustomFieldBlur(e: Equipment, defId: string) {
    const key = `${e.id}:${defId}`;
    const draft = customFieldDrafts[key];
    const current = e.customFields?.[defId] ?? '';
    if (draft === undefined || draft === current) return;
    try {
      await updateEquipmentCustomField(e.id, e.customFields, defId, draft);
    } catch (err) {
      console.error('Failed to update custom field', err);
    }
  }

  async function handleCustomFieldCheckboxChange(e: Equipment, defId: string, checked: boolean) {
    try {
      await updateEquipmentCustomField(e.id, e.customFields, defId, checked ? 'true' : 'false');
    } catch (err) {
      console.error('Failed to update custom field', err);
    }
  }

  function customFieldCellContent(e: Equipment, col: CustomFieldDefinition) {
    const def = customFieldDefFor(e, categoryDefs, col);
    if (!def) return <span className="text-slate-400">—</span>;
    const rawValue = e.customFields?.[def.id] ?? '';

    if (def.type === 'checkbox') {
      const checked = rawValue === 'true';
      return (
        <>
          <input
            type="checkbox"
            className="accent-primary-600 print:hidden"
            checked={checked}
            onChange={(ev) => handleCustomFieldCheckboxChange(e, def.id, ev.target.checked)}
          />
          <span className="hidden print:inline">{checked ? '✓' : ''}</span>
        </>
      );
    }

    const draft = customFieldDrafts[`${e.id}:${def.id}`] ?? rawValue;
    return (
      <>
        <input
          type={def.type === 'date' ? 'date' : 'text'}
          className="block w-full bg-transparent border-0 rounded px-1 py-0.5 -mx-1 -my-0.5 leading-tight focus:outline-none focus:ring-1 focus:ring-primary-400 print:hidden"
          value={draft}
          onChange={(ev) => handleCustomFieldChange(e.id, def.id, ev.target.value)}
          onBlur={() => handleCustomFieldBlur(e, def.id)}
        />
        <span className="hidden print:inline break-words">{rawValue || '—'}</span>
      </>
    );
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    }
    if (showFilters) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilters]);

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
    setSubcategory([]);
  }

  useEffect(() => {
    setSubcategory((prev) => {
      const next = prev.filter((s) => subcategories.includes(s));
      return next.length === prev.length ? prev : next;
    });
  }, [subcategories]);

  const statusOptions = useMemo(
    () => Array.from(new Set(equipment.map((e) => e.status))).sort(),
    [equipment],
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(equipment.map((e) => e.location).filter(Boolean))).sort(),
    [equipment],
  );
  const areaOptions = useMemo(
    () => Array.from(new Set(equipment.map((e) => e.area).filter(Boolean))).sort(),
    [equipment],
  );
  const assignedToOptions = useMemo(
    () => Array.from(new Set(equipment.map((e) => e.assignedTo).filter(Boolean))).sort(),
    [equipment],
  );

  const activeFilterCount =
    (category !== 'All' ? 1 : 0) +
    (subcategory.length > 0 ? 1 : 0) +
    (statusFilter.length > 0 ? 1 : 0) +
    (locationFilter.length > 0 ? 1 : 0) +
    (areaFilter.length > 0 ? 1 : 0) +
    (assignedToFilter.length > 0 ? 1 : 0);

  function clearFilters() {
    handleCategoryChange('All');
    setStatusFilter([]);
    setLocationFilter([]);
    setAreaFilter([]);
    setAssignedToFilter([]);
  }

  const filtered = useMemo(
    () =>
      equipment
        .filter((e) => category === 'All' || e.category === category)
        .filter((e) => subcategory.length === 0 || subcategory.includes(e.subcategory))
        .filter((e) => statusFilter.length === 0 || statusFilter.includes(e.status))
        .filter((e) => locationFilter.length === 0 || locationFilter.includes(e.location))
        .filter((e) => areaFilter.length === 0 || areaFilter.includes(e.area))
        .filter((e) => assignedToFilter.length === 0 || assignedToFilter.includes(e.assignedTo)),
    [equipment, category, subcategory, statusFilter, locationFilter, areaFilter, assignedToFilter],
  );

  const customCols = useMemo(() => customFieldColumns(categoryDefs), [categoryDefs]);
  const detailColsById = useMemo(() => new Map(ALL_DETAIL_COLUMNS.map((col) => [col.id, col])), []);
  const customColsById = useMemo(() => new Map(customCols.map((col) => [col.id, col])), [customCols]);

  function sortValue(e: Equipment, key: string): string {
    switch (key) {
      case 'status':
        return e.status;
      case 'subcategory':
        return e.subcategory || '';
      case 'item':
        return e.item || '';
      case 'location':
        return e.location || '';
      case 'area':
        return e.area || '';
      case 'assignedTo':
        return e.assignedTo || '';
      case 'purchaseDate':
        return e.purchaseDate || '';
      case 'notes':
        return e.statusDetails || '';
      case 'remarks':
        return e.remarks || '';
      case 'category':
        return e.category || '';
      case 'inventoryCode':
        return e.inventoryCode || '';
      case 'serialNumber':
        return e.serialNumber || '';
      case 'assignedType':
        return e.assignedType || '';
      case 'department':
        return departmentSortKey(e.department);
      case 'ministry':
        return e.ministry || '';
      case 'availability':
        return reportAvailabilityLabel(e);
      default: {
        const col = customCols.find((c) => c.id === key);
        return col ? customFieldValue(e, categoryDefs, col) : '';
      }
    }
  }

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    const dirMult = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
      return cmp !== 0 ? cmp * dirMult : a.item.localeCompare(b.item);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, customCols, categoryDefs]);

  const subcategoryLabel = subcategory.length === 0 ? 'All' : subcategory.join(', ');

  const { isVisible: isColumnVisible, toggle: toggleColumn, showAll: showAllColumns } = useColumnVisibility(
    'report-columns',
    EXTRA_DETAIL_COLUMN_IDS,
  );

  const allColumnIds = useMemo(
    () => [...ALL_DETAIL_COLUMNS.map((col) => col.id), ...customCols.map((col) => col.id), 'notes', 'remarks'],
    [customCols],
  );
  const { orderedIds: columnOrder, moveUp: moveColumnUp, moveDown: moveColumnDown } = useColumnOrder(
    'report-column-order',
    allColumnIds,
  );

  // Raw labels (used by the column picker and sort menu). Custom field
  // headers get run through `customFieldHeaderLabel` only in the table itself.
  const pickerLabelsById = useMemo(() => {
    const map = new Map<string, string>();
    ALL_DETAIL_COLUMNS.forEach((col) => map.set(col.id, col.label));
    customCols.forEach((col) => map.set(col.id, col.name));
    map.set('notes', 'Notes');
    map.set('remarks', 'Remarks');
    return map;
  }, [customCols]);

  function columnHeaderLabel(id: string): string {
    const customCol = customColsById.get(id);
    if (customCol) return customFieldHeaderLabel(customCol.name);
    return pickerLabelsById.get(id) ?? id;
  }

  function columnHeaderClassName(id: string): string {
    if (id === 'notes') return '!whitespace-normal text-left w-full print:w-auto';
    if (id === 'remarks') return '!whitespace-normal text-center w-full print:w-auto';
    const customCol = customColsById.get(id);
    if (customCol) return customCol.type === 'checkbox' ? 'text-center print:!whitespace-normal' : 'text-left print:!whitespace-normal';
    return id === 'status' || id === 'department' || id === 'ministry'
      ? '!whitespace-normal text-center'
      : 'text-left print:!whitespace-normal';
  }

  const columnPickerOptions = useMemo(
    () =>
      columnOrder
        .map((id) => {
          const label = pickerLabelsById.get(id);
          return label ? { id, label } : null;
        })
        .filter((opt): opt is ColumnPickerOption => opt !== null),
    [columnOrder, pickerLabelsById],
  );

  const visibleColumnIds = useMemo(
    () => columnOrder.filter((id) => isColumnVisible(id)),
    [columnOrder, isColumnVisible],
  );
  const totalDetailColumns = visibleColumnIds.length + 1;

  // Equalize every detail row to the height of the tallest row (measured from
  // natural, unwrapped-by-us content), so rows stay visually even even though
  // some cells wrap to more lines than others. Recomputed on resize and when
  // entering/leaving print (print uses smaller fonts/padding, so its tallest
  // row is a different pixel height than screen's).
  useLayoutEffect(() => {
    function recomputeRowHeight() {
      const rows = Array.from(detailRowRefs.current.values());
      if (rows.length === 0) {
        setDetailRowHeight(null);
        return;
      }
      rows.forEach((row) => {
        row.style.height = 'auto';
      });
      const max = rows.reduce((tallest, row) => Math.max(tallest, row.offsetHeight), 0);
      setDetailRowHeight(max || null);
    }
    recomputeRowHeight();
    window.addEventListener('resize', recomputeRowHeight);
    const printQuery = window.matchMedia('print');
    printQuery.addEventListener('change', recomputeRowHeight);
    window.addEventListener('beforeprint', recomputeRowHeight);
    window.addEventListener('afterprint', recomputeRowHeight);
    return () => {
      window.removeEventListener('resize', recomputeRowHeight);
      printQuery.removeEventListener('change', recomputeRowHeight);
      window.removeEventListener('beforeprint', recomputeRowHeight);
      window.removeEventListener('afterprint', recomputeRowHeight);
    };
  }, [sorted, visibleColumnIds]);

  // Recompute each visible column's print width share so the table always
  // fills 100% no matter which optional columns are toggled on/off.
  const columnWidthPct = useMemo(() => {
    const weights = new Map<string, number>();
    visibleColumnIds.forEach((id) => {
      if (id === 'notes') weights.set(id, NOTES_COL_WEIGHT);
      else if (id === 'remarks') weights.set(id, REMARKS_COL_WEIGHT);
      else if (detailColsById.has(id)) weights.set(id, detailColsById.get(id)!.weight);
      else if (customColsById.has(id)) weights.set(id, CUSTOM_FIELD_COL_WEIGHT);
    });
    const totalWeight = Array.from(weights.values()).reduce((sum, w) => sum + w, 0) || 1;
    const pct = new Map<string, number>();
    weights.forEach((w, id) => pct.set(id, (w / totalWeight) * 100));
    return pct;
  }, [visibleColumnIds, detailColsById, customColsById]);

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
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              className="btn-secondary whitespace-nowrap relative inline-flex items-center gap-1.5"
              onClick={() => setShowFilters((v) => !v)}
              title="Filter"
              aria-label="Filter"
            >
              <IconFilter />
              <span className="hidden md:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-primary-600 text-white text-[10px] w-4 h-4 align-middle">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {showFilters && (
              <div className="absolute right-0 mt-2 w-64 card p-4 space-y-3 z-30 shadow-lg">
                <Field label="Category">
                  <select className="input" value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
                    <option value="All">All categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sub Category">
                  <MultiSelectDropdown
                    label="sub categories"
                    options={subcategories}
                    selected={subcategory}
                    onChange={setSubcategory}
                    disabled={subcategories.length === 0}
                  />
                </Field>
                <Field label="Status">
                  <MultiSelectDropdown
                    label="statuses"
                    options={statusOptions}
                    selected={statusFilter}
                    onChange={setStatusFilter}
                    disabled={statusOptions.length === 0}
                  />
                </Field>
                <Field label="Location">
                  <MultiSelectDropdown
                    label="locations"
                    options={locationOptions}
                    selected={locationFilter}
                    onChange={setLocationFilter}
                    disabled={locationOptions.length === 0}
                  />
                </Field>
                <Field label="Area">
                  <MultiSelectDropdown
                    label="areas"
                    options={areaOptions}
                    selected={areaFilter}
                    onChange={setAreaFilter}
                    disabled={areaOptions.length === 0}
                  />
                </Field>
                <Field label="Assigned To">
                  <MultiSelectDropdown
                    label="assignees"
                    options={assignedToOptions}
                    selected={assignedToFilter}
                    onChange={setAssignedToFilter}
                    disabled={assignedToOptions.length === 0}
                  />
                </Field>
                <div className="flex justify-end">
                  <button type="button" className="text-xs text-slate-500 hover:underline" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              </div>
            )}
          </div>
          <SortButton options={columnPickerOptions} sortKey={sortKey} sortDir={sortDir} onSelect={toggleSort} />
          <ColumnPickerButton
            columns={columnPickerOptions}
            isVisible={isColumnVisible}
            onToggle={toggleColumn}
            onShowAll={showAllColumns}
            onMoveUp={moveColumnUp}
            onMoveDown={moveColumnDown}
          />
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

      <div className="card space-y-1.5 print:space-y-0.5 print:shadow-none print:ring-0 print:p-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold text-slate-800 print:text-xs">EQUIPMENT INVENTORY DETAILS</h2>
          <div className="flex flex-col items-end gap-1">
            <StatusLegend />
            <span className="text-sm text-slate-500 print:text-[10px]">as of {today}</span>
          </div>
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
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full table-auto print:table-fixed text-xs sm:text-sm print:text-[10px] border border-black border-collapse">
            <colgroup>
              {visibleColumnIds.map((id) => (
                <col
                  key={id}
                  className="print:w-[var(--col-w)]"
                  style={{ '--col-w': `${columnWidthPct.get(id) ?? 0}%` } as React.CSSProperties}
                />
              ))}
              <col className="w-8 print:hidden" />
            </colgroup>
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {visibleColumnIds.map((id) => (
                  <Th
                    key={id}
                    className={columnHeaderClassName(id)}
                    onClick={() => toggleSort(id)}
                    title={customColsById.get(id)?.name}
                  >
                    <span className="inline-flex items-center gap-1">
                      {columnHeaderLabel(id)}
                      <SortIndicator active={sortKey === id} dir={sortDir} />
                    </span>
                  </Th>
                ))}
                <Th className="print:hidden">{''}</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr
                  key={e.id}
                  ref={(el) => {
                    if (el) detailRowRefs.current.set(e.id, el);
                    else detailRowRefs.current.delete(e.id);
                  }}
                  style={detailRowHeight ? { height: `${detailRowHeight}px` } : undefined}
                  className={highlightedDetails.has(e.id) ? 'bg-orange-100 print:bg-orange-100' : ''}
                >
                  {visibleColumnIds.map((id) => {
                    if (id === 'notes') {
                      return (
                        <Td key={id} className="text-left w-full print:w-auto">
                          <span className="block max-w-[16rem] break-words print:max-w-none">
                            {e.statusDetails || ''}
                          </span>
                        </Td>
                      );
                    }
                    if (id === 'remarks') {
                      return (
                        <Td key={id} className="text-center w-full print:w-auto">
                          <textarea
                            className="block w-full max-w-[16rem] mx-auto resize-none bg-transparent border-0 rounded px-1 py-0.5 -my-0.5 leading-tight text-center focus:outline-none focus:ring-1 focus:ring-primary-400 print:hidden"
                            rows={1}
                            value={remarksDrafts[e.id] ?? e.remarks}
                            onChange={(ev) => handleRemarksChange(e.id, ev.target.value)}
                            onBlur={() => handleRemarksBlur(e)}
                          />
                          <span className="hidden print:block break-words">{e.remarks || ''}</span>
                        </Td>
                      );
                    }
                    const customCol = customColsById.get(id);
                    if (customCol) {
                      return (
                        <Td
                          key={id}
                          className={`whitespace-normal break-words ${
                            customCol.type === 'checkbox' ? 'text-center' : 'text-left'
                          }`}
                        >
                          {customFieldCellContent(e, customCol)}
                        </Td>
                      );
                    }
                    return (
                      <Td
                        key={id}
                        className={`whitespace-normal break-words ${
                          id === 'status' || id === 'department' || id === 'ministry' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {detailCellContent(e, id)}
                      </Td>
                    );
                  })}
                  <Td className="text-center print:hidden">
                    <HighlightButton
                      active={highlightedDetails.has(e.id)}
                      onClick={() => toggleDetailHighlight(e.id)}
                    />
                  </Td>
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
            {subcategoryLabel}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm print:text-[10px] border border-black border-collapse">
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
                <tr key={row.item}>
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
                <tr className="border-t-2 border-black font-semibold bg-slate-200">
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
          <table className="min-w-full text-xs sm:text-sm print:text-[10px] border border-black border-collapse">
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
                <tr key={row.id}>
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
    case 'area':
      return e.area || '—';
    case 'assignedTo':
      return e.assignedTo || '—';
    case 'subcategory':
      return e.subcategory || '—';
    case 'purchaseDate':
      return formatDate(e.purchaseDate);
    case 'category':
      return e.category || '—';
    case 'inventoryCode':
      return e.inventoryCode || '—';
    case 'serialNumber':
      return e.serialNumber || '—';
    case 'assignedType':
      return e.assignedType || '—';
    case 'department':
      return <span title={e.department || ''}>{departmentAlias(e.department)}</span>;
    case 'ministry':
      return e.ministry || '—';
    case 'availability':
      return reportAvailabilityLabel(e);
    default:
      return null;
  }
}

function reportAvailabilityLabel(e: Equipment): string {
  if (e.pulloutStatus) {
    return e.pulloutStatus === 'pulled_out' ? 'Pulled out' : 'Scheduled for pull-out';
  }
  if (e.assignedType === 'Fixed') return 'Fixed — not borrowable';
  if (e.assignedType === 'Issued') return e.assignedTo ? `Issued to ${e.assignedTo}` : 'Issued';
  return e.isBorrowed ? 'Borrowed' : 'Available';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Th({
  children,
  className = '',
  onClick,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <th
      className={`border border-black px-2 py-2 lg:px-3 text-left font-semibold whitespace-nowrap leading-tight print:whitespace-normal print:px-1 print:py-0.5 print:text-[10px] ${
        onClick ? 'cursor-pointer select-none hover:text-slate-900' : ''
      } ${className}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </th>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return <span className="text-[10px] text-slate-400 print:hidden">{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`border border-black px-2 py-2 lg:px-3 align-middle text-slate-700 leading-tight print:px-1 print:py-0.5 print:text-[10px] ${className}`}>
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
      className={`${active ? 'text-orange-500 hover:text-orange-600' : 'text-slate-300 hover:text-orange-400'} ${className}`}
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
