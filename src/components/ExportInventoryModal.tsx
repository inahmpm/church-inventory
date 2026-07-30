import { useMemo, useState } from 'react';
import { ASSIGNED_TYPES, EQUIPMENT_STATUSES } from '../types';
import type { AssignedType, Equipment, EquipmentStatus } from '../types';
import { downloadCsv, toCsv } from '../lib/csv';

const AVAILABILITY_OPTIONS = ['All', 'Available', 'Borrowed'] as const;
type Availability = (typeof AVAILABILITY_OPTIONS)[number];

const CSV_HEADERS = [
  'Category',
  'Subcategory',
  'Inventory Code',
  'Item',
  'Assigned Type',
  'Assigned To',
  'Department',
  'Ministry',
  'Location',
  'Purchase Date',
  'Status',
  'Status Details',
  'Availability',
];

export default function ExportInventoryModal({
  equipment,
  onClose,
}: {
  equipment: Equipment[];
  onClose: () => void;
}) {
  const categories = useMemo(
    () => Array.from(new Set(equipment.map((e) => e.category))).sort(),
    [equipment],
  );

  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState<'All' | EquipmentStatus>('All');
  const [assignedType, setAssignedType] = useState<'All' | AssignedType>('All');
  const [availability, setAvailability] = useState<Availability>('All');
  const [assignedTo, setAssignedTo] = useState('');

  const filtered = useMemo(() => {
    return equipment.filter((e) => {
      if (category !== 'All' && e.category !== category) return false;
      if (status !== 'All' && e.status !== status) return false;
      if (assignedType !== 'All' && e.assignedType !== assignedType) return false;
      if (availability === 'Available' && e.isBorrowed) return false;
      if (availability === 'Borrowed' && !e.isBorrowed) return false;
      if (assignedTo.trim() && !e.assignedTo.toLowerCase().includes(assignedTo.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [equipment, category, status, assignedType, availability, assignedTo]);

  function handleExport() {
    const rows = filtered.map((e) => [
      e.category,
      e.subcategory,
      e.inventoryCode,
      e.item,
      e.assignedType,
      e.assignedTo,
      e.department,
      e.ministry,
      e.location,
      e.purchaseDate,
      e.status,
      e.statusDetails,
      e.isBorrowed ? 'Borrowed' : 'Available',
    ]);
    const csv = toCsv(CSV_HEADERS, rows);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`inventory-export-${date}.csv`, csv);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="card max-w-lg w-full space-y-4">
        <h2 className="font-semibold text-slate-800 text-lg">Export Inventory</h2>

        <Field label="Category">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'All' | EquipmentStatus)}
          >
            <option value="All">All statuses</option>
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
            value={assignedType}
            onChange={(e) => setAssignedType(e.target.value as 'All' | AssignedType)}
          >
            <option value="All">All types</option>
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
            value={availability}
            onChange={(e) => setAvailability(e.target.value as Availability)}
          >
            {AVAILABILITY_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Assigned to contains">
          <input
            className="input"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Optional, e.g. Media Ministry"
          />
        </Field>

        <p className="text-sm text-slate-500">
          {filtered.length} of {equipment.length} item{equipment.length === 1 ? '' : 's'} match this filter.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleExport} disabled={filtered.length === 0}>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
