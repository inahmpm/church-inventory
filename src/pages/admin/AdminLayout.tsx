import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { getMinistry } from '../../lib/ministries';
import { subscribeBorrowRequests } from '../../lib/borrowRequests';
import type { BorrowRequest, Ministry } from '../../types';

export default function AdminLayout() {
  const { authUser, profile } = useCurrentUser();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [active, setActive] = useState<BorrowRequest[]>([]);
  const [ministry, setMinistry] = useState<Ministry | null>(null);

  const ministryId = profile?.ministryId;

  useEffect(() => {
    if (!ministryId) return;
    return subscribeBorrowRequests(['pending', 'borrowed'], setRequests, ministryId);
  }, [ministryId]);
  useEffect(() => {
    if (!ministryId) return;
    return subscribeBorrowRequests(['borrowed'], setActive, ministryId);
  }, [ministryId]);
  useEffect(() => {
    if (!ministryId) {
      setMinistry(null);
      return;
    }
    getMinistry(ministryId).then(setMinistry);
  }, [ministryId]);

  const pendingCount = requests.filter((r) => !r.fulfilledAt).length;
  const activeCount = active.filter((r) => r.fulfilledAt).length;

  const canManageUsers = profile?.role === 'ministry-admin' || profile?.role === 'super-admin';
  const canManageMinistries = profile?.role === 'super-admin';

  const navGroups: {
    label?: string;
    items: { to: string; label: string; end?: boolean; count?: number; external?: boolean }[];
  }[] = [
    { items: [{ to: '/admin', label: 'Dashboard', end: true }] },
    { items: [{ to: '/admin/inventory', label: 'Equipment Inventory' }] },
    { items: [{ to: '/admin/pullout', label: 'Equipment Pull-out' }] },
    {
      label: 'Equipment Borrowing',
      items: [
        { to: '/admin/requests', label: 'Borrow Requests', count: pendingCount },
        { to: '/admin/active', label: 'Active Borrows', count: activeCount },
        { to: '/admin/history', label: 'Return History' },
        { to: '/admin/request-history', label: 'Borrow Request History' },
        ...(ministry?.slug
          ? [{ to: `/borrow/${ministry.slug}`, label: "Borrower's Form", external: true }]
          : []),
      ],
    },
    { items: [{ to: '/admin/report', label: 'Reporting' }] },
    {
      label: 'Settings',
      items: [
        ...(canManageUsers ? [{ to: '/admin/users', label: 'Users' }] : []),
        ...(canManageMinistries ? [{ to: '/admin/ministries', label: 'Ministries' }] : []),
        { to: '/admin/categories', label: 'Equipment Categories' },
      ],
    },
    { items: [{ to: '/admin/logs', label: 'History Logs' }] },
  ];

  const navItems = navGroups.flatMap((group) => group.items);

  if (authUser === undefined || profile === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  }
  if (authUser === null) {
    return <Navigate to="/admin/login" replace />;
  }
  if (profile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-center px-4">
        Your account isn't set up in any ministry yet. Ask an admin to add you.
      </div>
    );
  }
  if (!profile.active) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-center px-4">
        Your access has been disabled. Contact your ministry admin.
      </div>
    );
  }
  if (profile.mustChangePassword && location.pathname !== '/admin/change-password') {
    return <Navigate to="/admin/change-password" replace />;
  }

  const activeLabel = navItems.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  )?.label;

  return (
    <div className="min-h-screen bg-slate-50 md:flex md:h-screen md:overflow-hidden">
      <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-slate-200 bg-white sticky top-0 z-40">
        <button
          className="text-slate-600 p-2 -ml-2"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>
        <span className="font-semibold text-slate-800 text-sm">{activeLabel ?? 'Church Inventory'}</span>
        <div className="w-8" />
      </header>

      {menuOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 font-semibold text-slate-800">
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="8" y="8" width="8" height="8" rx="1.5" />
                <path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" strokeLinecap="round" />
              </svg>
            </span>
            <span className="truncate">{ministry?.name ?? 'Church Inventory'}</span>
          </span>
          <button
            className="md:hidden text-slate-400 hover:text-slate-600 text-xl leading-none"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            &times;
          </button>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4">
          {navGroups.map((group, i) => (
            <div key={group.label ?? i}>
              {group.label && (
                <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group.label}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) =>
                  item.external ? (
                    <a
                      key={item.to}
                      href={item.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      <span>{item.label}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
                        <path d="M7 17L17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  ) : (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium ${
                          isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100'
                        }`
                      }
                    >
                      <span>{item.label}</span>
                      {!!item.count && (
                        <span className="ml-2 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-600 text-white text-xs font-semibold flex items-center justify-center">
                          {item.count}
                        </span>
                      )}
                    </NavLink>
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-slate-200 space-y-2">
          <div className="text-sm text-slate-500 truncate">{authUser.email}</div>
          <button
            className="text-sm text-slate-500 hover:text-slate-800"
            onClick={() => signOut(auth)}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 md:h-screen md:overflow-y-auto">
        <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
