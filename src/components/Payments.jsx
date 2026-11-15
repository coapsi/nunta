import React from 'react';
import { useStore } from '../lib/store.jsx';
import { uid } from '../lib/api.js';
import { money } from '../lib/calc.js';
import { Cell } from './ui.jsx';

// Transele de plata ale unei cheltuieli: avans, rate, rest.
export default function Payments({ expense, currency, total }) {
  const { payments, mutate } = useStore();
  const list = payments.filter((p) => p.expense_id === expense.id);
  const planned = list.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const save = (id, patch) => mutate({ op: 'save', table: 'payments', row: { id, ...patch } });
  const add = () =>
    mutate({
      op: 'save',
      table: 'payments',
      row: { id: uid(), expense_id: expense.id, label: list.length ? 'Tranșă' : 'Avans', amount: 0, due_date: null, paid: false, sort: list.length },
    });

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-stone-600">Plăți</span>
        <button className="text-xs font-medium text-olive-700 hover:underline" onClick={add}>
          + tranșă
        </button>
      </div>
      {!list.length && <div className="text-xs text-stone-400">Nicio tranșă. Adaugă avansul și restul de plată, cu termene.</div>}
      {list.map((p) => (
        <div key={p.id} className="flex items-center gap-1.5 border-t border-stone-100 py-0.5">
          <input type="checkbox" className="h-4 w-4 accent-olive-600" checked={!!p.paid} onChange={(e) => save(p.id, { paid: e.target.checked })} title="Plătit" />
          <Cell className="min-w-0 flex-1" value={p.label} placeholder="Avans, rest..." onCommit={(v) => save(p.id, { label: v })} />
          <Cell className="!w-24" type="number" value={p.amount} onCommit={(v) => save(p.id, { amount: v })} />
          <input
            type="date"
            className="rounded-md border border-transparent bg-transparent px-1 py-1 text-xs text-stone-600 hover:border-stone-200"
            value={p.due_date || ''}
            onChange={(e) => save(p.id, { due_date: e.target.value || null })}
          />
          <button className="px-1 text-stone-300 hover:text-red-600" onClick={() => mutate({ op: 'delete', table: 'payments', id: p.id })}>
            ✕
          </button>
        </div>
      ))}
      {list.length > 0 && total != null && (
        <div className="mt-1 text-xs text-stone-500">
          Planificat {money(planned, currency)} din {money(total, currency)}
          {Math.abs(total - planned) >= 1 && <span className="text-clay-600"> · neacoperit {money(total - planned, currency)}</span>}
        </div>
      )}
    </div>
  );
}
