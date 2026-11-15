import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { rpc } from './api.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const EMPTY = { settings: {}, members: [], invitations: [], guests: [], tables: [], expenses: [] };

function applyOps(state, ops) {
  const next = { ...state };
  for (const o of ops) {
    const list = [...(next[o.table] || [])];
    if (o.op === 'save') {
      const i = list.findIndex((r) => r.id === o.row.id);
      if (i >= 0) list[i] = { ...list[i], ...o.row };
      else list.push({ ...o.row });
      next[o.table] = list;
    } else if (o.op === 'delete') {
      next[o.table] = list.filter((r) => r.id !== o.id);
      if (o.table === 'invitations') next.guests = next.guests.filter((g) => g.invitation_id !== o.id);
      if (o.table === 'tables')
        next.guests = next.guests.map((g) => (g.table_id === o.id ? { ...g, table_id: null, seat: null } : g));
    }
  }
  return next;
}

// Din raspunsul serverului luam doar campurile pe care nu le avem inca local (token, valori implicite),
// ca sa nu suprascriem ce a tastat omul intre timp.
function mergeServer(state, saved) {
  const next = { ...state };
  for (const { table, row } of saved) {
    next[table] = (next[table] || []).map((r) => {
      if (r.id !== row.id) return r;
      const merged = { ...r };
      for (const k of Object.keys(row)) if (merged[k] === undefined) merged[k] = row[k];
      return merged;
    });
  }
  return next;
}

export function StoreProvider({ children, onUnauthorized }) {
  const [state, setState] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const pending = useRef(0);
  const queue = useRef(Promise.resolve());

  const notify = useCallback((text, kind = 'ok') => {
    setToast({ text, kind, at: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const reload = useCallback(async () => {
    try {
      const data = await rpc('state.load');
      if (pending.current === 0) setState(data);
    } catch (e) {
      if (e.status === 401) onUnauthorized?.();
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    reload();
    const onFocus = () => pending.current === 0 && reload();
    window.addEventListener('focus', onFocus);
    const timer = setInterval(() => {
      if (pending.current === 0 && document.visibilityState === 'visible') reload();
    }, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(timer);
    };
  }, [reload]);

  // Salveaza imediat pe ecran, apoi trimite la server, in ordine.
  const mutate = useCallback(
    (ops) => {
      const list = (Array.isArray(ops) ? ops : [ops]).filter(Boolean);
      if (!list.length) return Promise.resolve();
      setState((s) => applyOps(s, list));
      pending.current += 1;
      const run = queue.current.then(async () => {
        try {
          const { saved } = await rpc('batch', { ops: list });
          setState((s) => mergeServer(s, saved));
        } catch (e) {
          notify(e.message, 'error');
          if (e.status === 401) onUnauthorized?.();
          pending.current = Math.max(0, pending.current - 1);
          if (pending.current === 0) await reload();
          return;
        }
        pending.current = Math.max(0, pending.current - 1);
      });
      queue.current = run;
      return run;
    },
    [notify, reload, onUnauthorized],
  );

  const settingsTimer = useRef(null);
  const saveSettings = useCallback(
    (data) => {
      setState((s) => ({ ...s, settings: data }));
      if (!settingsTimer.current) pending.current += 1;
      clearTimeout(settingsTimer.current);
      settingsTimer.current = setTimeout(async () => {
        settingsTimer.current = null;
        try {
          await rpc('settings.save', { data });
        } catch (e) {
          notify(e.message, 'error');
        }
        pending.current = Math.max(0, pending.current - 1);
      }, 500);
    },
    [notify],
  );

  const setMembers = useCallback((fn) => setState((s) => ({ ...s, members: fn(s.members) })), []);

  return (
    <Ctx.Provider value={{ ...state, loading, reload, mutate, saveSettings, setMembers, notify }}>
      {children}
      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-lg ${
            toast.kind === 'error' ? 'bg-red-600' : 'bg-stone-800'
          }`}
        >
          {toast.text}
        </div>
      )}
    </Ctx.Provider>
  );
}
