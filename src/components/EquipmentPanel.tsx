import { useEffect, useState, type FormEvent } from 'react';
import { generateInventoryCode } from '../lib/equipment';
import { HISTORY_LOG_ACTION_COLORS, HISTORY_LOG_ACTION_LABELS, subscribeHistoryLogs } from '../lib/historyLogs';
import { ASSIGNED_TYPES, EQUIPMENT_STATUSES, visibleCustomFields } from '../types';
import type { AssignedType, Category, Equipment, EquipmentStatus, HistoryLogEntry, Ministry, NewEquipment } from '../types';
import QrCodeLabel from './QrCodeLabel';
import { printQrLabels } from '../lib/printQrLabels';

export default function EquipmentPanel({
  initial,
  categories,
  ministry,
  open,
  existingCodes,
  onClose,
  onSubmit,
  onDelete,
}: {
  initial?: Equipment;
  categories: Category[];
  ministry: Ministry;
  open: boolean;
  existingCodes?: string[];
  onClose: () => void;
  onSubmit: (data: NewEquipment) => Promise<void>;
  onDelete?: (e: Equipment) => void;
}) {
  const [form, setForm] = useState<NewEquipment>(blankForm(ministry.id, initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<HistoryLogEntry | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? blankForm(ministry.id, initial)
          : {
              ...blankForm(ministry.id, initial),
              inventoryCode: generateInventoryCode(ministry.inventoryCodePrefix, existingCodes ?? []),
            },
      );
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, open]);

  useEffect(() => {
    if (!open || !initial) {
      setHistory([]);
      return;
    }
    return subscribeHistoryLogs(ministry.id, (logs) => setHistory(logs.filter((l) => l.equipmentId === initial.id)));
  }, [initial, open, ministry.id]);

  const selectedCategory = categories.find((c) => c.name === form.category);
  const subcategoryOptions = selectedCategory?.subcategories ?? [];
  const hiddenFields = ministry.hiddenFields;
  const customFieldDefs = visibleCustomFields(selectedCategory);

  function setCustomField(fieldId: string, value: string) {
    setForm({ ...form, customFields: { ...form.customFields, [fieldId]: value } });
  }

  async function handlePrintLabel() {
    if (!form.inventoryCode) return;
    await printQrLabels([{ inventoryCode: form.inventoryCode, item: form.item }]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save equipment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-lg">{initial ? 'Edit Equipment' : 'Add Equipment'}</h2>
          <button className="text-slate-400 hover:text-slate-600 text-xl leading-none" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {form.inventoryCode && (
            <div className="flex flex-col items-center gap-2 py-2 border-b border-slate-100">
              <QrCodeLabel value={form.inventoryCode} itemName={form.item} />
              <button type="button" className="btn-secondary text-sm" onClick={handlePrintLabel}>
                Print Label
              </button>
            </div>
          )}

          <Field label="Category">
            <select
              required
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: '' })}
            >
              <option value="" disabled>
                Select a category...
              </option>
              {form.category && !categories.some((c) => c.name === form.category) && (
                <option value={form.category}>{form.category}</option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          {!hiddenFields.includes('subcategory') && (
            <Field label="Subcategory">
              <select
                className="input"
                value={form.subcategory}
                onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                disabled={!subcategoryOptions.length}
              >
                <option value="">None</option>
                {form.subcategory && !subcategoryOptions.includes(form.subcategory) && (
                  <option value={form.subcategory}>{form.subcategory}</option>
                )}
                {subcategoryOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Inventory Code (QR code value)">
            <input
              readOnly
              disabled
              className="input font-mono bg-slate-50 text-slate-500 cursor-not-allowed"
              value={form.inventoryCode}
            />
          </Field>

          <Field label="Item">
            <input
              required
              className="input"
              value={form.item}
              onChange={(e) => setForm({ ...form, item: e.target.value })}
              placeholder="e.g. Shure SM58 Wireless Mic"
            />
          </Field>

          {!hiddenFields.includes('serialNumber') && (
            <Field label="Serial Number">
              <input
                className="input"
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                placeholder="Manufacturer serial number (optional)"
              />
            </Field>
          )}

          {!hiddenFields.includes('assignedType') && (
            <Field label="Assigned Type">
              <select
                required
                className="input"
                value={form.assignedType}
                onChange={(e) => setForm({ ...form, assignedType: e.target.value as AssignedType })}
              >
                {ASSIGNED_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                {form.assignedType === 'Borrowable' && 'Can be scanned into a borrow request; tracks available/borrowed.'}
                {form.assignedType === 'Fixed' && 'Installed in a fixed location — cannot be borrowed or scanned.'}
                {form.assignedType === 'Issued' && 'Assigned to a person, but can be re-issued to someone else later.'}
              </p>
            </Field>
          )}

          {!hiddenFields.includes('assignedTo') && (
            <Field label="Assigned to">
              <input
                className="input"
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                placeholder="Person/ministry primarily responsible (optional)"
              />
            </Field>
          )}

          {!hiddenFields.includes('department') && (
            <Field label="Department">
              <input
                className="input"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Worship (optional)"
              />
            </Field>
          )}

          {!hiddenFields.includes('ministry') && (
            <Field label="Ministry">
              <input
                className="input"
                value={form.ministry}
                onChange={(e) => setForm({ ...form, ministry: e.target.value })}
                placeholder="e.g. Youth Ministry (optional)"
              />
            </Field>
          )}

          {!hiddenFields.includes('location') && (
            <Field label="Location">
              <input
                className="input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Main Sanctuary, Storage Room (optional)"
              />
            </Field>
          )}

          {!hiddenFields.includes('area') && (
            <Field label="Area">
              <input
                className="input"
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder="e.g. Building A, Second Floor (optional)"
              />
            </Field>
          )}

          {!hiddenFields.includes('purchaseDate') && (
            <Field label="Purchase Date">
              <input
                type="date"
                className="input"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
              />
            </Field>
          )}

          <Field label="Status">
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as EquipmentStatus })}
            >
              {EQUIPMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          {!hiddenFields.includes('statusDetails') && (
            <Field label="Status Details">
              <textarea
                className="input min-h-[70px]"
                value={form.statusDetails}
                onChange={(e) => setForm({ ...form, statusDetails: e.target.value })}
                placeholder="Notes, e.g. cracked casing, needs new battery..."
              />
            </Field>
          )}

          {customFieldDefs.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <span className="block text-sm font-medium text-slate-700">
                {form.category} Fields
              </span>
              {customFieldDefs.map((def) => (
                <Field key={def.id} label={def.name}>
                  {def.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={form.customFields[def.id] === 'true'}
                      onChange={(e) => setCustomField(def.id, e.target.checked ? 'true' : 'false')}
                    />
                  ) : (
                    <input
                      type={def.type === 'date' ? 'date' : 'text'}
                      className="input"
                      value={form.customFields[def.id] ?? ''}
                      onChange={(e) => setCustomField(def.id, e.target.value)}
                    />
                  )}
                </Field>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {initial && (
            <div className="pt-2 border-t border-slate-100">
              <span className="block text-sm font-medium text-slate-700 mb-2">History</span>
              {history.length === 0 && <p className="text-xs text-slate-400">No movements logged yet.</p>}
              <ul className="space-y-2">
                {history.map((log) => (
                  <li
                    key={log.id}
                    className="text-xs border border-slate-100 rounded-lg p-2 cursor-pointer hover:bg-slate-50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${HISTORY_LOG_ACTION_COLORS[log.action]}`}
                      >
                        {HISTORY_LOG_ACTION_LABELS[log.action]}
                      </span>
                      <span className="text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-slate-600 line-clamp-2">{log.details}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-200">
          <div>
            {initial && onDelete && (
              <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => onDelete(initial)}>
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        </form>
      </div>

      {selectedLog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div className="card w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-800">{selectedLog.item}</div>
                <div className="text-xs font-mono text-slate-400">{selectedLog.inventoryCode}</div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${HISTORY_LOG_ACTION_COLORS[selectedLog.action]}`}
              >
                {HISTORY_LOG_ACTION_LABELS[selectedLog.action]}
              </span>
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">{selectedLog.details}</div>
            <div className="text-xs text-slate-400">
              {new Date(selectedLog.timestamp).toLocaleString()}
              {selectedLog.actor ? ` · ${selectedLog.actor}` : ''}
            </div>
            <div className="flex justify-end pt-1">
              <button type="button" className="btn-secondary" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


function blankForm(ministryId: string, initial?: Equipment): NewEquipment {
  return {
    ministryId: initial?.ministryId ?? ministryId,
    category: initial?.category ?? '',
    subcategory: initial?.subcategory ?? '',
    inventoryCode: initial?.inventoryCode ?? '',
    item: initial?.item ?? '',
    serialNumber: initial?.serialNumber ?? '',
    assignedType: initial?.assignedType ?? 'Borrowable',
    assignedTo: initial?.assignedTo ?? '',
    department: initial?.department ?? '',
    ministry: initial?.ministry ?? '',
    location: initial?.location ?? '',
    area: initial?.area ?? '',
    purchaseDate: initial?.purchaseDate ?? '',
    status: initial?.status ?? 'Good Condition',
    statusDetails: initial?.statusDetails ?? '',
    customFields: initial?.customFields ?? {},
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
