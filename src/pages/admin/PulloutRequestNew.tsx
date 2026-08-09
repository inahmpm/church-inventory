import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPulloutRequest } from '../../lib/pulloutRequests';
import { useActiveMinistry } from '../../lib/MinistryContext';

function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PulloutRequestNew() {
  const { ministryId } = useActiveMinistry();
  const navigate = useNavigate();

  const [purpose, setPurpose] = useState('');
  const [pulloutAt, setPulloutAt] = useState(() => toDatetimeLocal(Date.now()));
  const [returnDueAt, setReturnDueAt] = useState(() => toDatetimeLocal(Date.now() + 2 * 60 * 60 * 1000));
  const [destination, setDestination] = useState('');
  const [requestorName, setRequestorName] = useState('');
  const [requestorEmail, setRequestorEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ministryId) return;

    if (!purpose.trim()) return setError('Enter the pull-out purpose.');
    if (!destination.trim()) return setError('Enter the destination.');
    if (!requestorName.trim()) return setError('Enter the requestor name.');
    const pulloutMs = new Date(pulloutAt).getTime();
    const returnMs = new Date(returnDueAt).getTime();
    if (!pulloutAt || Number.isNaN(pulloutMs)) return setError('Enter the pull-out date and time.');
    if (!returnDueAt || Number.isNaN(returnMs)) return setError('Enter the return date and time.');
    if (returnMs < pulloutMs) return setError('Return date must be on or after the pull-out date.');

    setError('');
    setSaving(true);
    try {
      const id = await createPulloutRequest({
        ministryId,
        purpose: purpose.trim(),
        pulloutAt: pulloutMs,
        returnDueAt: returnMs,
        destination: destination.trim(),
        requestorName: requestorName.trim(),
        requestorEmail: requestorEmail.trim() || null,
      });
      navigate(`/admin/pullout/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pull-out request.');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-semibold text-slate-800">New Pull-out Request</h1>

      <form onSubmit={handleSubmit} className="card p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Pull-out Purpose</label>
          <input
            className="input"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Sunday Service Livestream"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pull-out Date &amp; Time</label>
            <input
              type="datetime-local"
              className="input"
              value={pulloutAt}
              onChange={(e) => setPulloutAt(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Return Date &amp; Time</label>
            <input
              type="datetime-local"
              className="input"
              value={returnDueAt}
              onChange={(e) => setReturnDueAt(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
          <input
            className="input"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Main Sanctuary, Off-site venue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Requestor Name</label>
          <input
            className="input"
            value={requestorName}
            onChange={(e) => setRequestorName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Requestor Email (optional)</label>
          <input
            type="email"
            className="input"
            value={requestorEmail}
            onChange={(e) => setRequestorEmail(e.target.value)}
            placeholder="For status-change notifications"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
