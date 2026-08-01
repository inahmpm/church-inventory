import { useState, type FormEvent } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          required
          className="input pr-10 w-full"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </label>
  );
}

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('Not signed in');
      try {
        await updatePassword(user, password);
      } catch (err) {
        if (err instanceof FirebaseError && err.code === 'auth/requires-recent-login') {
          if (!currentPassword) {
            setError('Your session has expired. Enter your current password to continue.');
            return;
          }
          const credential = EmailAuthProvider.credential(user.email, currentPassword);
          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, password);
        } else {
          throw err;
        }
      }
      await updateDoc(doc(db, 'users', user.uid), { mustChangePassword: false });
    } catch (err) {
      if (err instanceof FirebaseError && err.code === 'auth/invalid-credential') {
        setError('Current password is incorrect.');
      } else if (err instanceof FirebaseError && err.code === 'auth/weak-password') {
        setError('Password is too weak. Choose a stronger password.');
      } else {
        setError('Could not update password. Try signing out and back in, then retry.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="card max-w-sm w-full space-y-4">
        <h1 className="text-xl font-semibold text-slate-800 text-center mb-2">Set a new password</h1>
        <p className="text-sm text-slate-500 text-center -mt-2">
          You're using a temporary password. Choose a new one to continue.
        </p>
        <PasswordField label="Current (temporary) password" value={currentPassword} onChange={setCurrentPassword} />
        <PasswordField label="New password" value={password} onChange={setPassword} />
        <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Saving...' : 'Save password'}
        </button>
      </form>
    </div>
  );
}
