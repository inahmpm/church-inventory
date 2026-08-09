import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { getMinistry, subscribeMinistries } from './ministries';
import type { Ministry } from '../types';

const ACTIVE_MINISTRY_STORAGE_KEY = 'activeMinistryId';

interface MinistryContextValue {
  ministryId: string | undefined;
  ministry: Ministry | null;
  ministries: Ministry[];
  isSuperAdmin: boolean;
  setMinistryId: (id: string) => void;
}

const MinistryContext = createContext<MinistryContextValue | null>(null);

export function MinistryProvider({ children }: { children: ReactNode }) {
  const { profile } = useCurrentUser();
  const isSuperAdmin = profile?.role === 'super-admin';
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [selectedMinistryId, setSelectedMinistryId] = useState(
    () => sessionStorage.getItem(ACTIVE_MINISTRY_STORAGE_KEY) ?? '',
  );
  const [ministry, setMinistry] = useState<Ministry | null>(null);

  const ministryId = isSuperAdmin ? selectedMinistryId || profile?.ministryId : profile?.ministryId;

  useEffect(() => {
    if (!isSuperAdmin) return;
    return subscribeMinistries(setMinistries);
  }, [isSuperAdmin]);

  // Seed the switcher with the super-admin's own ministry on first load, and
  // fall back to it if a previously-selected ministry no longer exists.
  useEffect(() => {
    if (!isSuperAdmin || !profile?.ministryId) return;
    if (!selectedMinistryId || (ministries.length > 0 && !ministries.some((m) => m.id === selectedMinistryId))) {
      setSelectedMinistryId(profile.ministryId);
    }
  }, [isSuperAdmin, profile?.ministryId, selectedMinistryId, ministries]);

  useEffect(() => {
    if (!ministryId) {
      setMinistry(null);
      return;
    }
    getMinistry(ministryId).then(setMinistry);
  }, [ministryId]);

  function setMinistryIdAndPersist(id: string) {
    sessionStorage.setItem(ACTIVE_MINISTRY_STORAGE_KEY, id);
    setSelectedMinistryId(id);
  }

  return (
    <MinistryContext.Provider
      value={{ ministryId, ministry, ministries, isSuperAdmin, setMinistryId: setMinistryIdAndPersist }}
    >
      {children}
    </MinistryContext.Provider>
  );
}

export function useActiveMinistry(): MinistryContextValue {
  const ctx = useContext(MinistryContext);
  if (!ctx) throw new Error('useActiveMinistry must be used within a MinistryProvider');
  return ctx;
}
