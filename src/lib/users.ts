import { deleteApp, getApps, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase';
import type { AppUser, UserRole } from '../types';

const usersCol = collection(db, 'users');

export function subscribeMinistryUsers(ministryId: string, cb: (users: AppUser[]) => void) {
  const q = query(usersCol, where('ministryId', '==', ministryId), orderBy('email'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<AppUser, 'uid'>) })));
  });
}

/**
 * Creates a new Firebase Auth account + matching /users profile doc, without
 * disturbing the calling admin's own signed-in session. Firebase's client SDK
 * signs in as whichever user it just created, so the account is created on a
 * throwaway secondary app instance instead of the shared `auth` instance.
 */
export async function createUserInMinistry(
  name: string,
  email: string,
  tempPassword: string,
  ministryId: string,
  role: UserRole,
) {
  const secondaryName = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
    const uid = credential.user.uid;
    await setDoc(doc(db, 'users', uid), {
      name,
      email,
      ministryId,
      role,
      active: true,
      mustChangePassword: true,
      createdAt: Date.now(),
    } satisfies Omit<AppUser, 'uid'>);
    return uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    const app = getApps().find((a) => a.name === secondaryName);
    if (app) await deleteApp(app);
  }
}

export async function sendUserPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function setUserActive(uid: string, active: boolean) {
  await updateDoc(doc(db, 'users', uid), { active });
}

export async function setUserRole(uid: string, role: UserRole) {
  await updateDoc(doc(db, 'users', uid), { role });
}

export async function setUserName(uid: string, name: string) {
  await updateDoc(doc(db, 'users', uid), { name });
}
