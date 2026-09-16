import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { submitBorrowRequest } from '../lib/borrowRequests';
import { getMinistryBySlug } from '../lib/ministries';
import type { Ministry } from '../types';
import { formatDateTime } from '../lib/date';

const initialForm = {
  name: '',
  email: '',
  ministry: '',
  contactNo: '',
  venue: '',
  equipmentRequested: '',
};

export default function BorrowForm() {
  const { ministrySlug } = useParams<{ ministrySlug: string }>();
  const [ministry, setMinistry] = useState<Ministry | null | undefined>(undefined); // undefined = loading
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!ministrySlug) return;
    getMinistryBySlug(ministrySlug).then(setMinistry);
  }, [ministrySlug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ministry) return;
    setSubmitting(true);
    try {
      await submitBorrowRequest({ ...form, ministryId: ministry.id }, ministry.notificationEmail ?? '');
      setSubmittedAt(Date.now());
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (ministry === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  }

  if (ministry === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 text-center text-slate-500">
        This borrow link doesn't match any ministry. Double-check the URL with your ministry admin.
      </div>
    );
  }

  if (submittedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Request submitted</h1>
          <p className="text-slate-500 mb-1">
            Submitted on {formatDateTime(submittedAt)}
          </p>
          <p className="text-slate-500 mb-6">
            {ministry.name} has received your request. They'll reach out once your equipment is
            ready for pick-up.
          </p>
          <button
            className="text-sm text-primary-600 font-medium hover:underline"
            onClick={() => setSubmittedAt(null)}
          >
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 flex justify-center">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-slate-800">{ministry.name} Equipment Borrower's Form</h1>
          <p className="text-slate-500 mt-1">
            Fill this out to request equipment from {ministry.name} for your ministry/event.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 space-y-4">
          <Field label="Name">
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
            />
          </Field>

          <Field label="Email">
            <input
              required
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Ministry">
            <input
              required
              className="input"
              value={form.ministry}
              onChange={(e) => setForm({ ...form, ministry: e.target.value })}
              placeholder="e.g. Worship, Media, Youth"
            />
          </Field>

          <Field label="Contact No.">
            <input
              required
              type="tel"
              className="input"
              value={form.contactNo}
              onChange={(e) => setForm({ ...form, contactNo: e.target.value })}
              placeholder="09XXXXXXXXX"
            />
          </Field>

          <Field label="Venue">
            <input
              required
              className="input"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              placeholder="Where will the equipment be used?"
            />
          </Field>

          <Field label="Equipment to borrow">
            <textarea
              required
              className="input min-h-[90px]"
              value={form.equipmentRequested}
              onChange={(e) => setForm({ ...form, equipmentRequested: e.target.value })}
              placeholder="List the equipment you need, e.g. 2x wireless mic, 1x projector"
            />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary-600 text-white font-medium rounded-xl py-2.5 hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
          <p className="text-xs text-slate-400 text-center">
            Date and time will be recorded automatically upon submission.
          </p>
        </form>
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
