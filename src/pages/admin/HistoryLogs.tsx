import { useEffect, useMemo, useState } from 'react';
import {
  HISTORY_LOG_ACTION_COLORS as ACTION_COLORS,
  HISTORY_LOG_ACTION_LABELS as ACTION_LABELS,
  subscribeHistoryLogs,
} from '../../lib/historyLogs';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { HISTORY_LOG_ACTIONS } from '../../types';
import type { HistoryLogAction, HistoryLogEntry } from '../../types';

export default function HistoryLogs() {
  const { profile } = useCurrentUser();
  const ministryId = profile?.ministryId;
  const [logs, setLogs] = useState<HistoryLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<'' | HistoryLogAction>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<HistoryLogEntry | null>(null);

  useEffect(() => {
    if (!ministryId) return;
    return subscribeHistoryLogs(ministryId, setLogs, (err) => setError(err.message));
  }, [ministryId]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false;
      if (q) {
        const matches = [log.item, log.inventoryCode, log.details, log.actor ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [logs, search, actionFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-slate-800">History Logs</h1>
        <div className="flex flex-wrap gap-2">
          <input
            className="input w-full sm:w-64"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as '' | HistoryLogAction)}
          >
            <option value="">All actions</option>
            {HISTORY_LOG_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="card text-center text-red-600 py-10">Couldn't load history logs: {error}</div>
      )}

      {!error && rows.length === 0 && <div className="card text-center text-slate-400 py-10">No movements logged yet.</div>}

      {rows.length > 0 && (
        <>
          {/* Mobile card list */}
          <div className="space-y-2 sm:hidden">
            {rows.map((log) => (
              <div
                key={log.id}
                className="card p-3 space-y-1 cursor-pointer hover:bg-slate-50"
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{log.item}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action]}`}>
                    {ACTION_LABELS[log.action]}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400">{log.inventoryCode}</div>
                <div className="text-xs text-slate-600">{log.details}</div>
                <div className="text-xs text-slate-400">
                  {new Date(log.timestamp).toLocaleString()}
                  {log.actor ? ` · ${log.actor}` : ''}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop / tablet table */}
          <div className="card overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">QR Code</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Details</th>
                  <th className="py-2 pr-4 font-medium hidden md:table-cell">By</th>
                  <th className="py-2 pr-4 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((log) => (
                  <tr key={log.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedLog(log)}>
                    <td className="py-2 pr-4 text-slate-800">{log.item}</td>
                    <td className="py-2 pr-4 font-mono text-slate-400">{log.inventoryCode}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action]}`}>
                        {ACTION_LABELS[log.action]}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-600 max-w-xs truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 hidden md:table-cell">{log.actor || '—'}</td>
                    <td className="py-2 pr-4 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedLog && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div className="card w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-800">{selectedLog.item}</div>
                <div className="text-xs font-mono text-slate-400">{selectedLog.inventoryCode}</div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${ACTION_COLORS[selectedLog.action]}`}
              >
                {ACTION_LABELS[selectedLog.action]}
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
    </div>
  );
}
