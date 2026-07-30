import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createEquipment,
  deleteEquipment,
  deleteEquipmentBulk,
  subscribeEquipment,
  updateEquipment,
} from '../../lib/equipment';
import { subscribeCategories } from '../../lib/categories';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { getMinistry } from '../../lib/ministries';
import { ASSIGNED_TYPES, EQUIPMENT_STATUSES } from '../../types';
import type { Ministry } from '../../types';
import type { AssignedType, Category, Equipment, NewEquipment } from '../../types';
import EquipmentPanel from '../../components/EquipmentPanel';
import ImportInventoryModal from '../../components/ImportInventoryModal';
import ExportInventoryModal from '../../components/ExportInventoryModal';
import { printQrLabels } from '../../lib/printQrLabels';

const PAGE_SIZE = 20;

type SortKey =
  | 'category'
  | 'subcategory'
  | 'inventoryCode'
  | 'item'
  | 'serialNumber'
  | 'assignedType'
  | 'assignedTo'
  | 'department'
  | 'ministry'
  | 'location'
  | 'purchaseDate'
  | 'status'
  | 'availability';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Subcategory', className: 'hidden md:table-cell' },
  { key: 'inventoryCode', label: 'Inventory Code' },
  { key: 'item', label: 'Items' },
  { key: 'serialNumber', label: 'Serial Number', className: 'hidden lg:table-cell' },
  { key: 'assignedType', label: 'Assigned Type' },
  { key: 'assignedTo', label: 'Assigned to', className: 'hidden md:table-cell' },
  { key: 'department', label: 'Department', className: 'hidden lg:table-cell' },
  { key: 'ministry', label: 'Ministry', className: 'hidden lg:table-cell' },
  { key: 'location', label: 'Location', className: 'hidden lg:table-cell' },
  { key: 'purchaseDate', label: 'Purchase Date', className: 'hidden xl:table-cell' },
  { key: 'status', label: 'Status' },
  { key: 'availability', label: 'Availability', className: 'hidden sm:table-cell' },
];

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

function IconFilter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M4 5h16l-6 7v6l-4 2v-8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M12 16V4m0 0 4 4m-4-4-4 4M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M12 4v12m0 0 4-4m-4 4-4-4M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M12 4v16M4 12h16" strokeLinecap="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function availabilityLabel(e: Equipment) {
  if (e.assignedType === 'Fixed') {
    return <span className="text-slate-500 font-medium">Fixed — not borrowable</span>;
  }
  if (e.assignedType === 'Issued') {
    return (
      <span className="text-sky-600 font-medium">Issued{e.assignedTo ? ` to ${e.assignedTo}` : ''}</span>
    );
  }
  return e.isBorrowed ? (
    <span className="text-amber-600 font-medium">Borrowed</span>
  ) : (
    <span className="text-green-600 font-medium">Available</span>
  );
}

export default function Inventory() {
  const { profile } = useCurrentUser();
  const ministryId = profile?.ministryId;
  const [ministry, setMinistry] = useState<Ministry | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Equipment | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedTypeFilter, setAssignedTypeFilter] = useState<'' | AssignedType>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'' | 'available' | 'borrowed'>('');
  const [sortKey, setSortKey] = useState<SortKey>('category');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ministryId) return;
    return subscribeEquipment(ministryId, setEquipment);
  }, [ministryId]);
  useEffect(() => {
    if (!ministryId) return;
    return subscribeCategories(ministryId, setCategories);
  }, [ministryId]);
  useEffect(() => {
    if (!ministryId) return;
    getMinistry(ministryId).then(setMinistry);
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

  const categoryFilterOptions = useMemo(
    () => Array.from(new Set(equipment.map((e) => e.category))).sort(),
    [equipment],
  );

  const subcategoryFilterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          equipment
            .filter((e) => !categoryFilter || e.category === categoryFilter)
            .map((e) => e.subcategory)
            .filter((s): s is string => Boolean(s)),
        ),
      ).sort(),
    [equipment, categoryFilter],
  );

  const activeFilterCount = [
    categoryFilter,
    subcategoryFilter,
    statusFilter,
    assignedTypeFilter,
    availabilityFilter,
  ].filter(Boolean).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return equipment.filter((e) => {
      if (q) {
        const matches = [
          e.category,
          e.subcategory,
          e.inventoryCode,
          e.item,
          e.serialNumber,
          e.assignedTo,
          e.department,
          e.ministry,
          e.location,
          e.status,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
        if (!matches) return false;
      }
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (subcategoryFilter && e.subcategory !== subcategoryFilter) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      if (assignedTypeFilter && e.assignedType !== assignedTypeFilter) return false;
      if (availabilityFilter === 'available' && (e.assignedType !== 'Borrowable' || e.isBorrowed)) return false;
      if (availabilityFilter === 'borrowed' && (e.assignedType !== 'Borrowable' || !e.isBorrowed)) return false;
      return true;
    });
  }, [equipment, search, categoryFilter, subcategoryFilter, statusFilter, assignedTypeFilter, availabilityFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [filtered, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, subcategoryFilter, statusFilter, assignedTypeFilter, availabilityFilter, sortKey, sortDir]);

  useEffect(() => {
    if (subcategoryFilter && !subcategoryFilterOptions.includes(subcategoryFilter)) {
      setSubcategoryFilter('');
    }
  }, [subcategoryFilterOptions, subcategoryFilter]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(equipment.map((e) => e.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [equipment]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pageAllSelected = paged.length > 0 && paged.every((e) => selectedIds.has(e.id));

  function togglePageSelected() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) {
        paged.forEach((e) => next.delete(e.id));
      } else {
        paged.forEach((e) => next.add(e.id));
      }
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function clearFilters() {
    setCategoryFilter('');
    setSubcategoryFilter('');
    setStatusFilter('');
    setAssignedTypeFilter('');
    setAvailabilityFilter('');
  }

  async function handleSave(data: NewEquipment) {
    if (selected === 'new') {
      await createEquipment(data);
    } else if (selected) {
      await updateEquipment(selected.id, data, selected);
    }
  }

  async function handleDelete(e: Equipment) {
    if (e.isBorrowed) {
      alert('This item is currently borrowed and cannot be deleted.');
      return;
    }
    if (confirm(`Delete "${e.item}" (${e.inventoryCode})? This cannot be undone.`)) {
      await deleteEquipment(e.id, e);
      setSelected(null);
    }
  }

  async function handleBulkDelete() {
    const selectedItems = equipment.filter((e) => selectedIds.has(e.id));
    const borrowed = selectedItems.filter((e) => e.isBorrowed);
    const deletable = selectedItems.filter((e) => !e.isBorrowed);

    if (deletable.length === 0) {
      alert('The selected item(s) are currently borrowed and cannot be deleted.');
      return;
    }

    const warning =
      borrowed.length > 0
        ? `${borrowed.length} of the selected items are currently borrowed and will be skipped. `
        : '';
    if (!confirm(`${warning}Delete ${deletable.length} item(s)? This cannot be undone.`)) return;

    await deleteEquipmentBulk(deletable);
    setSelectedIds(new Set());
  }

  async function handleBulkPrint() {
    const selectedItems = equipment.filter((e) => selectedIds.has(e.id));
    await printQrLabels(selectedItems);
  }

  async function handleDeleteAll() {
    const borrowed = equipment.filter((e) => e.isBorrowed);
    const deletable = equipment.filter((e) => !e.isBorrowed);

    if (deletable.length === 0) {
      alert('There are no items in the inventory that can be deleted.');
      return;
    }

    const warning =
      borrowed.length > 0
        ? `${borrowed.length} item(s) are currently borrowed and will be skipped. `
        : '';
    const confirmation = prompt(
      `${warning}This will permanently delete ALL ${deletable.length} item(s) in the inventory. This cannot be undone.\n\nType DELETE to confirm.`,
    );
    if (confirmation !== 'DELETE') return;

    await deleteEquipmentBulk(deletable, 'Removed from inventory (delete all)');
    setSelectedIds(new Set());
    setSelected(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-800">Equipment Inventory</h1>
          <button
            className="btn-primary whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
            onClick={() => setSelected('new')}
            aria-label="Add Equipment"
          >
            <IconPlus />
            <span className="hidden sm:inline">Add Equipment</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[10rem]">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              <IconSearch />
            </span>
            <input
              className="input w-full pl-8"
              placeholder="Search inventory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {selectedIds.size > 0 && (
            <button
              className="btn-secondary whitespace-nowrap inline-flex items-center gap-1.5"
              onClick={handleBulkPrint}
              title={`Print QR Codes (${selectedIds.size})`}
              aria-label={`Print QR Codes (${selectedIds.size})`}
            >
              <IconPrinter />
              <span className="hidden md:inline">Print QR ({selectedIds.size})</span>
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              className="btn-secondary whitespace-nowrap text-red-600 inline-flex items-center gap-1.5"
              onClick={handleBulkDelete}
              title={`Delete Selected (${selectedIds.size})`}
              aria-label={`Delete Selected (${selectedIds.size})`}
            >
              <IconTrash />
              <span className="hidden md:inline">Delete Selected ({selectedIds.size})</span>
            </button>
          )}
          <div className="relative" ref={filterRef}>
            <button
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
                  <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="">All</option>
                    {categoryFilterOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Subcategory">
                  <select
                    className="input"
                    value={subcategoryFilter}
                    onChange={(e) => setSubcategoryFilter(e.target.value)}
                    disabled={subcategoryFilterOptions.length === 0}
                  >
                    <option value="">All</option>
                    {subcategoryFilterOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All</option>
                    {EQUIPMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assigned Type">
                  <select
                    className="input"
                    value={assignedTypeFilter}
                    onChange={(e) => setAssignedTypeFilter(e.target.value as '' | AssignedType)}
                  >
                    <option value="">All</option>
                    {ASSIGNED_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Availability">
                  <select
                    className="input"
                    value={availabilityFilter}
                    onChange={(e) => setAvailabilityFilter(e.target.value as '' | 'available' | 'borrowed')}
                  >
                    <option value="">All</option>
                    <option value="available">Available</option>
                    <option value="borrowed">Borrowed</option>
                  </select>
                </Field>
                <div className="flex justify-end">
                  <button className="text-xs text-slate-500 hover:underline" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            className="btn-secondary whitespace-nowrap inline-flex items-center gap-1.5"
            onClick={() => setImporting(true)}
            title="Import Inventory"
            aria-label="Import Inventory"
          >
            <IconUpload />
            <span className="hidden md:inline">Import</span>
          </button>
          <button
            className="btn-secondary whitespace-nowrap inline-flex items-center gap-1.5"
            onClick={() => setExporting(true)}
            title="Export Inventory"
            aria-label="Export Inventory"
          >
            <IconDownload />
            <span className="hidden md:inline">Export</span>
          </button>
          {equipment.length > 0 && (
            <button
              className="btn-secondary whitespace-nowrap text-red-600 inline-flex items-center gap-1.5"
              onClick={handleDeleteAll}
              title="Delete All"
              aria-label="Delete All"
            >
              <IconTrash />
              <span className="hidden md:inline">Delete All</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="space-y-2 sm:hidden">
        {paged.map((e) => {
          const isSelected = selected !== 'new' && selected?.id === e.id;
          return (
            <div
              key={e.id}
              onClick={() => setSelected(e)}
              className={`card p-3 space-y-1 cursor-pointer ${isSelected ? 'ring-2 ring-primary-400' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selectedIds.has(e.id)}
                    onClick={(ev) => ev.stopPropagation()}
                    onChange={() => toggleSelected(e.id)}
                  />
                  <span className="font-medium text-slate-800">{e.item}</span>
                </span>
                <StatusBadge status={e.status} />
              </div>
              <div className="text-xs text-slate-500 font-mono">{e.inventoryCode}</div>
              <div className="text-xs text-slate-500">
                {e.category}
                {e.subcategory ? ` / ${e.subcategory}` : ''}
              </div>
              <div className="text-xs text-slate-500">{e.assignedType}</div>
              <div className="text-xs">{availabilityLabel(e)}</div>
            </div>
          );
        })}
        {paged.length === 0 && <div className="text-center text-slate-400 py-8">No equipment found.</div>}
      </div>

      {/* Desktop / tablet table */}
      <div className="card overflow-x-auto p-0 hidden sm:block">
        <table className="min-w-full text-xs lg:text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <Th>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={pageAllSelected}
                  onChange={togglePageSelected}
                />
              </Th>
              {COLUMNS.map((col) => (
                <Th key={col.key} className={col.className} onClick={() => toggleSort(col.key)}>
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIndicator active={sortKey === col.key} dir={sortDir} />
                  </span>
                </Th>
              ))}
              <Th className="hidden xl:table-cell">Status Details</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.map((e) => {
              const isSelected = selected !== 'new' && selected?.id === e.id;
              return (
                <tr
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className={`cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-primary-50' : ''}`}
                >
                  <Td>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedIds.has(e.id)}
                      onClick={(ev) => ev.stopPropagation()}
                      onChange={() => toggleSelected(e.id)}
                    />
                  </Td>
                  <Td>{e.category}</Td>
                  <Td className="hidden md:table-cell">{e.subcategory || '—'}</Td>
                  <Td className="font-mono">{e.inventoryCode}</Td>
                  <Td>{e.item}</Td>
                  <Td className="hidden lg:table-cell font-mono">{e.serialNumber || '—'}</Td>
                  <Td>{e.assignedType}</Td>
                  <Td className="hidden md:table-cell">{e.assignedTo || '—'}</Td>
                  <Td className="hidden lg:table-cell">{e.department || '—'}</Td>
                  <Td className="hidden lg:table-cell">{e.ministry || '—'}</Td>
                  <Td className="hidden lg:table-cell">{e.location || '—'}</Td>
                  <Td className="hidden xl:table-cell">{e.purchaseDate || '—'}</Td>
                  <Td>
                    <StatusBadge status={e.status} />
                  </Td>
                  <Td className="hidden sm:table-cell">{availabilityLabel(e)}</Td>
                  <Td className="hidden xl:table-cell max-w-xs truncate" title={e.statusDetails}>
                    {e.statusDetails || '—'}
                  </Td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={15} className="text-center text-slate-400 py-8">
                  No equipment found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500">
          <span>
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary px-3 py-1"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn-secondary px-3 py-1"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {ministry && (
        <EquipmentPanel
          open={selected !== null}
          categories={categories}
          ministry={ministry}
          initial={selected === 'new' || selected === null ? undefined : selected}
          existingCodes={equipment.map((e) => e.inventoryCode)}
          onClose={() => setSelected(null)}
          onSubmit={handleSave}
          onDelete={handleDelete}
        />
      )}

      {importing && ministryId && (
        <ImportInventoryModal ministryId={ministryId} onClose={() => setImporting(false)} />
      )}

      {exporting && <ExportInventoryModal equipment={sorted} onClose={() => setExporting(false)} />}
    </div>
  );
}

function sortValue(e: Equipment, key: SortKey): string {
  switch (key) {
    case 'availability':
      if (e.assignedType !== 'Borrowable') return e.assignedType.toLowerCase();
      return e.isBorrowed ? 'borrowed' : 'available';
    default:
      return (e[key] || '').toLowerCase();
  }
}

function Th({
  children,
  className = '',
  onClick,
}: {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <th
      className={`px-2 py-2 lg:px-4 lg:py-3 font-medium select-none whitespace-nowrap ${onClick ? 'cursor-pointer hover:text-slate-700' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </th>
  );
}
function Td({ children, className = '', title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <td className={`px-2 py-2 lg:px-4 lg:py-3 text-slate-700 whitespace-nowrap ${className}`} title={title}>
      {children}
    </td>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return <span className="text-[10px] text-slate-400">{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Good Condition': 'bg-green-100 text-green-700',
    'Fair Condition': 'bg-lime-100 text-lime-700',
    'For Repair': 'bg-amber-100 text-amber-700',
    'For Replacement': 'bg-orange-100 text-orange-700',
    'For Disposal': 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}
