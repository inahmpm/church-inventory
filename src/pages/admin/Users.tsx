import { useEffect, useState, type FormEvent } from 'react';
import { getMinistry } from '../../lib/ministries';
import { useCurrentUser } from '../../lib/useCurrentUser';
import {
  createUserInMinistry,
  sendUserPasswordReset,
  setUserActive,
  setUserName,
  setUserRole,
  subscribeMinistryUsers,
} from '../../lib/users';
import type { AppUser, Ministry, UserRole } from '../../types';

function generateTempPassword() {
  return `Church${Math.floor(1000 + Math.random() * 9000)}!${Math.random().toString(36).slice(2, 6)}`;
}

export default function Users() {
  const { profile } = useCurrentUser();
  const [ministry, setMinistry] = useState<Ministry | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('member');
  const [savingEdit, setSavingEdit] = useState(false);
  const [resettingUid, setResettingUid] = useState<string | null>(null);
  const [resetSentUid, setResetSentUid] = useState<string | null>(null);

  const ministryId = profile?.ministryId;

  useEffect(() => {
    if (!ministryId) return;
    return subscribeMinistryUsers(ministryId, setUsers);
  }, [ministryId]);

  useEffect(() => {
    if (!ministryId) return;
    getMinistry(ministryId).then(setMinistry);
  }, [ministryId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    if (!ministryId) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) return;
    setCreating(true);
    try {
      const tempPassword = generateTempPassword();
      await createUserInMinistry(trimmedName, trimmedEmail, tempPassword, ministryId, role);
      setCreated({ email: trimmedEmail, tempPassword });
      setName('');
      setEmail('');
      setRole('member');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(u: AppUser) {
    setError(null);
    try {
      await setUserActive(u.uid, !u.active);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user.');
    }
  }

  function startEdit(u: AppUser) {
    setError(null);
    setEditingUid(u.uid);
    setEditName(u.name ?? '');
    setEditRole(u.role);
  }

  function cancelEdit() {
    setEditingUid(null);
  }

  async function handleSaveEdit(uid: string) {
    setError(null);
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    setSavingEdit(true);
    try {
      await setUserName(uid, trimmedName);
      await setUserRole(uid, editRole);
      setEditingUid(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleResetPassword(u: AppUser) {
    setError(null);
    setResetSentUid(null);
    setResettingUid(u.uid);
    try {
      await sendUserPasswordReset(u.email);
      setResetSentUid(u.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset email.');
    } finally {
      setResettingUid(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Users</h1>
        {ministry && (
          <p className="text-sm text-slate-500">
            {ministry.name}
            {ministry.department && (
              <span className="ml-2 inline-block rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                {ministry.department}
              </span>
            )}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {created && (
        <div className="card bg-green-50 border-green-200 text-sm text-green-800 space-y-1">
          <p className="font-medium">User created. Share these sign-in details:</p>
          <p>
            Email: <span className="font-mono">{created.email}</span>
          </p>
          <p>
            Temporary password: <span className="font-mono">{created.tempPassword}</span>
          </p>
          <p className="text-green-700">They'll be asked to set a new password on first login.</p>
        </div>
      )}

      <form onSubmit={handleCreate} className="card flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="block text-sm font-medium text-slate-700 mb-1">Name</span>
          <input
            type="text"
            className="input"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block flex-1">
          <span className="block text-sm font-medium text-slate-700 mb-1">Email</span>
          <input
            type="email"
            className="input"
            placeholder="teammate@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">Role</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="member">Member</option>
            <option value="ministry-admin">Ministry Admin</option>
            {profile?.role === 'super-admin' && <option value="super-admin">Super Admin</option>}
          </select>
        </label>
        <button type="submit" disabled={creating} className="btn-primary whitespace-nowrap">
          {creating ? 'Adding...' : '+ Add User'}
        </button>
      </form>

      <div className="space-y-2">
        {users.map((u) =>
          editingUid === u.uid ? (
            <div key={u.uid} className="card flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm text-slate-500">{u.email}</p>
              </div>
              <label className="block flex-1">
                <span className="block text-sm font-medium text-slate-700 mb-1">Name</span>
                <input
                  type="text"
                  className="input"
                  placeholder="Jane Doe"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">Role</span>
                <select
                  className="input"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                >
                  <option value="member">Member</option>
                  <option value="ministry-admin">Ministry Admin</option>
                  {profile?.role === 'super-admin' && <option value="super-admin">Super Admin</option>}
                </select>
              </label>
              <div className="flex gap-2">
                <button
                  className="btn-primary whitespace-nowrap"
                  disabled={savingEdit}
                  onClick={() => handleSaveEdit(u.uid)}
                >
                  {savingEdit ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={u.uid} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 break-words">{u.name || u.email}</p>
                <p className="text-sm text-slate-500 break-words">{u.email}</p>
                <p className="text-sm text-slate-500">
                  {ministry?.department && <>{ministry.department} &middot; </>}
                  {u.role} &middot; {u.active ? 'Active' : 'Disabled'}
                </p>
                {resetSentUid === u.uid && (
                  <p className="text-sm text-green-700">Password reset email sent.</p>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <button className="text-sm text-primary-600 hover:underline" onClick={() => startEdit(u)}>
                  Edit
                </button>
                <button
                  className="text-sm text-primary-600 hover:underline disabled:opacity-50"
                  disabled={resettingUid === u.uid}
                  onClick={() => handleResetPassword(u)}
                >
                  {resettingUid === u.uid ? 'Sending...' : 'Reset Password'}
                </button>
                <button
                  className={`text-sm hover:underline ${u.active ? 'text-red-600' : 'text-primary-600'}`}
                  onClick={() => handleToggleActive(u)}
                >
                  {u.active ? 'Disable' : 'Re-enable'}
                </button>
              </div>
            </div>
          ),
        )}
        {users.length === 0 && <div className="text-center text-slate-400 py-8">No users yet.</div>}
      </div>
    </div>
  );
}
