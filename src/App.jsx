import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { rpc } from './lib/api.js';
import { StoreProvider, useStore } from './lib/store.jsx';
import { eventOf } from './lib/calc.js';
import Login from './pages/Login.jsx';
import Activate from './pages/Activate.jsx';
import Invite from './pages/Invite.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Guests from './pages/Guests.jsx';
import Seating from './pages/Seating.jsx';
import Budget from './pages/Budget.jsx';
import Settings from './pages/Settings.jsx';
import Vendors from './pages/Vendors.jsx';
import Rooms from './pages/Rooms.jsx';
import Plan from './pages/Plan.jsx';

const NAV = [
  { to: '/', label: 'Acasă', end: true },
  { to: '/invitati', label: 'Invitați' },
  { to: '/mese', label: 'Mese' },
  { to: '/cazare', label: 'Cazare' },
  { to: '/buget', label: 'Buget' },
  { to: '/furnizori', label: 'Furnizori' },
  { to: '/planificare', label: 'Planificare' },
  { to: '/setari', label: 'Setări' },
];

function Shell({ member, onLogout }) {
  const { settings, loading } = useStore();
  const ev = eventOf(settings);
  const names = [ev.bride, ev.groom].filter(Boolean).join(' & ') || 'Nunta noastră';
  return (
    <div className="flex min-h-full flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-stone-200 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
          <div className="font-display text-xl font-semibold text-olive-800">{names}</div>
          <nav className="ml-2 flex flex-1 gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive ? 'bg-olive-600 text-white' : 'text-stone-600 hover:bg-stone-200/60'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden text-right text-xs text-stone-500 sm:block">
            <div className="font-medium text-stone-700">{member.name}</div>
            <button onClick={onLogout} className="hover:text-stone-800 hover:underline">
              Ieși din cont
            </button>
          </div>
          <button onClick={onLogout} className="text-xs text-stone-500 sm:hidden">
            Ieși
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {loading ? (
          <div className="py-24 text-center text-sm text-stone-500">Se încarcă...</div>
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/invitati" element={<Guests />} />
            <Route path="/mese" element={<Seating />} />
            <Route path="/buget" element={<Budget />} />
            <Route path="/cazare" element={<Rooms />} />
            <Route path="/furnizori" element={<Vendors />} />
            <Route path="/planificare" element={<Plan />} />
            <Route path="/setari" element={<Settings member={member} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

function AdminApp() {
  const [member, setMember] = useState(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    rpc('auth.me')
      .then((r) => setMember(r.member))
      .catch(() => setMember(null));
  }, []);

  const logout = useCallback(async () => {
    await rpc('auth.logout').catch(() => {});
    setMember(null);
    navigate('/');
  }, [navigate]);

  const onUnauthorized = useCallback(() => setMember(null), []);

  if (member === undefined) return <div className="py-24 text-center text-sm text-stone-500">Se încarcă...</div>;
  if (!member) return <Login onLogin={setMember} />;
  return (
    <StoreProvider onUnauthorized={onUnauthorized}>
      <Shell member={member} onLogout={logout} />
    </StoreProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/i/:token" element={<Invite />} />
      <Route path="/activare/:code" element={<Activate />} />
      <Route path="/*" element={<AdminApp />} />
    </Routes>
  );
}
