import { useState, type ChangeEvent } from 'react';
import { ASSIGNED_TYPES, EQUIPMENT_STATUSES } from '../types';
import type { AssignedType, EquipmentStatus, NewEquipment } from '../types';
import { parseCsv } from '../lib/csv';
import { createEquipment } from '../lib/equipment';

type ImportableEquipment = Omit<NewEquipment, 'ministryId'>;

interface ParsedRow {
  line: number;
  data: ImportableEquipment | null;
  error: string | null;
}

const HEADER_ALIASES: Record<string, keyof ImportableEquipment> = {
  category: 'category',
  subcategory: 'subcategory',
  'inventory code': 'inventoryCode',
  inventorycode: 'inventoryCode',
  'serial number': 'serialNumber',
  serialnumber: 'serialNumber',
  item: 'item',
  'assigned type': 'assignedType',
  assignedtype: 'assignedType',
  'assigned to': 'assignedTo',
  assignedto: 'assignedTo',
  department: 'department',
  ministry: 'ministry',
  location: 'location',
  'purchase date': 'purchaseDate',
  purchasedate: 'purchaseDate',
  status: 'status',
  'status details': 'statusDetails',
  statusdetails: 'statusDetails',
};

function parseRows(text: string): ParsedRow[] {
  const table = parseCsv(text);
  if (table.length === 0) return [];

  const headerRow = table[0].map((h) => h.trim().toLowerCase());
  const colIndex: Partial<Record<keyof ImportableEquipment, number>> = {};
  headerRow.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key) colIndex[key] = i;
  });

  return table.slice(1).map((cols, i) => {
    const line = i + 2;
    const get = (key: keyof ImportableEquipment) => {
      const idx = colIndex[key];
      return idx === undefined ? '' : (cols[idx] ?? '').trim();
    };

    const category = get('category');
    const inventoryCode = get('inventoryCode');
    const item = get('item');
    if (!item) {
      return { line, data: null, error: 'Missing required field (Item).' };
    }

    const statusRaw = get('status');
    const status = (EQUIPMENT_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as EquipmentStatus)
      : 'Good Condition';

    const assignedTypeRaw = get('assignedType');
    const assignedType = (ASSIGNED_TYPES as readonly string[]).includes(assignedTypeRaw)
      ? (assignedTypeRaw as AssignedType)
      : 'Borrowable';

    return {
      line,
      error: null,
      data: {
        category,
        subcategory: get('subcategory'),
        inventoryCode: inventoryCode.toUpperCase(),
        serialNumber: get('serialNumber'),
        item,
        assignedType,
        assignedTo: get('assignedTo'),
        department: get('department'),
        ministry: get('ministry'),
        location: get('location'),
        purchaseDate: get('purchaseDate'),
        status,
        statusDetails: get('statusDetails'),
      },
    };
  });
}

export default function ImportInventoryModal({
  ministryId,
  onClose,
}: {
  ministryId: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const text = await file.text();
    setRows(parseRows(text));
  }

  async function handleImport() {
    if (!rows) return;
    setImporting(true);
    let success = 0;
    let failed = 0;
    for (const row of rows) {
      if (!row.data) {
        failed++;
        continue;
      }
      try {
        await createEquipment({ ...row.data, ministryId });
        success++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    setResult({ success, failed });
  }

  const validCount = rows?.filter((r) => r.data).length ?? 0;
  const invalidRows = rows?.filter((r) => r.error) ?? [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="card max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-slate-800 text-lg">Import Inventory</h2>
        <p className="text-sm text-slate-500">
          Upload a CSV with columns: Category, Subcategory, Inventory Code, Serial Number, Item, Assigned Type,
          Assigned To, Department, Ministry, Location, Purchase Date, Status, Status Details. Only Item is required
          (Assigned Type defaults to Borrowable).
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />

        {rows && (
          <div className="text-sm space-y-1">
            <p className="text-slate-700">
              <span className="font-medium">{fileName}</span> — {rows.length} row{rows.length === 1 ? '' : 's'} found,{' '}
              <span className="text-green-600 font-medium">{validCount} valid</span>
              {invalidRows.length > 0 && (
                <>
                  , <span className="text-red-600 font-medium">{invalidRows.length} invalid</span>
                </>
              )}
              .
            </p>
            {invalidRows.length > 0 && (
              <ul className="text-red-600 max-h-24 overflow-y-auto list-disc pl-5">
                {invalidRows.map((r) => (
                  <li key={r.line}>
                    Line {r.line}: {r.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {result && (
          <p className="text-sm text-slate-700">
            Import finished: <span className="text-green-600 font-medium">{result.success} added</span>
            {result.failed > 0 && (
              <>
                , <span className="text-red-600 font-medium">{result.failed} failed</span>
              </>
            )}
            .
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              className="btn-primary"
              disabled={!rows || validCount === 0 || importing}
              onClick={handleImport}
            >
              {importing ? 'Importing...' : `Import ${validCount} item${validCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
