import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store.jsx';
import { budget, calcOf, eventOf, fmtDate, headcount, money, scenario, taskDue, todayIso, withPayments } from '../lib/calc.js';
import { Card, PageHeader, Stat } from '../components/ui.jsx';

function Bar({ parts }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-stone-100">
      {parts.map((p) => (
        <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { invitations, guests, tables, expenses: raw, payments, tasks, vendors, settings } = useStore();
  const expenses = useMemo(() => withPayments(raw, payments), [raw, payments]);
  const ev = eventOf(settings);
  const calc = calcOf(settings);
  const counts = useMemo(() => headcount(invitations, guests), [invitations, guests]);
  const tableCount = tables.filter((t) => t.shape !== 'zone').length;
  const s = scenario(calc, counts, tableCount);
  const b = budget(expenses, s, calc);
  const seats = tables.reduce((sum, t) => sum + (t.shape === 'zone' ? 0 : Number(t.seats) || 0), 0);
  const toSeat = counts.confirmed + counts.pending;
  const days = ev.date ? Math.ceil((new Date(ev.date + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000) : null;
  const unsent = invitations.filter((i) => !i.sent_at).length;

  const today = todayIso();
  const expById = Object.fromEntries(expenses.map((e) => [e.id, e]));
  const vendorById = Object.fromEntries(vendors.map((v) => [v.id, v]));
  const nextPayments = payments
    .filter((p) => !p.paid && Number(p.amount) > 0)
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
    .slice(0, 5);
  const openTasks = tasks
    .filter((t) => !t.done)
    .map((t) => ({ ...t, due: taskDue(t, ev.date) }))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.months_before - a.months_before);
  const doneTasks = tasks.length - openTasks.length;

  const todo = [
    !ev.date && { text: 'Completează data, locația și textul invitației', to: '/setari' },
    !invitations.length && { text: 'Adaugă lista de invitați', to: '/invitati' },
    invitations.length > 0 && unsent > 0 && { text: `Trimite invitațiile: ${unsent} netrimise`, to: '/invitati' },
    !expenses.length && { text: 'Trece costurile din oferte în buget', to: '/buget' },
    !tables.length && invitations.length > 0 && { text: 'Creează mesele și așază invitații', to: '/mese' },
    tables.length > 0 && seats < toSeat && { text: `Ai ${toSeat} persoane și doar ${seats} locuri la mese`, to: '/mese' },
    tables.length > 0 && counts.seated < toSeat && { text: `${toSeat - counts.seated} persoane nu au încă loc la masă`, to: '/mese' },
    !tasks.length && { text: 'Pornește checklistul cu lista recomandată', to: '/planificare' },
    !vendors.length && expenses.length > 0 && { text: 'Adaugă furnizorii și tranșele de plată', to: '/furnizori' },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title={[ev.bride, ev.groom].filter(Boolean).join(' & ') || 'Nunta noastră'}
        subtitle={
          ev.date
            ? `${new Date(ev.date + 'T00:00:00').toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${ev.venue ? ' · ' + ev.venue : ''}`
            : 'Completează data și locația în Setări.'
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Până la nuntă" value={days == null ? '-' : days >= 0 ? `${days} zile` : 'A trecut'} />
        <Stat label="Confirmați" value={counts.confirmed} tone="good" sub={`${counts.confirmedAdults} adulți, ${counts.confirmedChildren} copii`} />
        <Stat label="Cost estimat" value={money(b.total, ev.currency)} sub={`pentru ${s.adults} adulți și ${s.children} copii`} />
        <Stat label="Pe zero la" value={b.breakEvenPerAdult == null ? '-' : money(b.breakEvenPerAdult, ev.currency)} tone="clay" sub="dar mediu per adult" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-800">Răspunsuri</h3>
            <Link to="/invitati" className="text-xs font-medium text-olive-700 hover:underline">
              Vezi invitații
            </Link>
          </div>
          <Bar
            parts={[
              { label: 'Vin', value: counts.confirmed, color: '#6f874d' },
              { label: 'Fără răspuns', value: counts.pending, color: '#e0a684' },
              { label: 'Nu vin', value: counts.declined, color: '#d6d3d1' },
            ]}
          />
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-stone-600">Vin</dt><dd className="font-medium tabular-nums">{counts.confirmed}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-600">Fără răspuns</dt><dd className="font-medium tabular-nums">{counts.pending}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-600">Nu vin</dt><dd className="font-medium tabular-nums">{counts.declined}</dd></div>
            <div className="flex justify-between border-t border-stone-100 pt-1.5"><dt className="text-stone-600">Invitații trimise</dt><dd className="font-medium tabular-nums">{invitations.length - unsent} / {invitations.length}</dd></div>
          </dl>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-800">Mese</h3>
            <Link to="/mese" className="text-xs font-medium text-olive-700 hover:underline">
              Deschide planul
            </Link>
          </div>
          <Bar parts={[{ label: 'Așezați', value: counts.seated, color: '#6f874d' }, { label: 'Neașezați', value: Math.max(0, toSeat - counts.seated), color: '#e7e5e4' }]} />
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-stone-600">Mese</dt><dd className="font-medium tabular-nums">{tableCount}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-600">Locuri</dt><dd className="font-medium tabular-nums">{seats}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-600">Persoane așezate</dt><dd className="font-medium tabular-nums">{counts.seated} / {toSeat}</dd></div>
          </dl>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-800">Checklist</h3>
            <Link to="/planificare" className="text-xs font-medium text-olive-700 hover:underline">
              {tasks.length ? `${doneTasks} din ${tasks.length} făcute` : 'Deschide'}
            </Link>
          </div>
          {tasks.length > 0 && <Bar parts={[{ label: 'Făcute', value: doneTasks, color: '#6f874d' }, { label: 'Rămase', value: openTasks.length, color: '#e7e5e4' }]} />}
          <ul className="mt-3 space-y-1.5 text-sm">
            {openTasks.slice(0, 6).map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-stone-700">{t.title}</span>
                <span className={`shrink-0 text-xs ${t.due && t.due < today ? 'font-medium text-red-600' : 'text-stone-500'}`}>{t.due ? fmtDate(t.due) : ''}</span>
              </li>
            ))}
            {!openTasks.length && <li className="text-stone-500">{tasks.length ? 'Totul e bifat.' : 'Checklistul e gol.'}</li>}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-800">Plăți care urmează</h3>
            <Link to="/furnizori" className="text-xs font-medium text-olive-700 hover:underline">
              Furnizori
            </Link>
          </div>
          <ul className="space-y-1.5 text-sm">
            {nextPayments.map((p) => {
              const e = expById[p.expense_id];
              return (
                <li key={p.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-stone-700">
                    {p.label}
                    <span className="text-stone-400"> · {vendorById[e?.vendor_id]?.name || e?.name}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="font-medium tabular-nums">{money(p.amount, ev.currency)}</span>
                    {p.due_date && <span className={`ml-2 text-xs ${p.due_date < today ? 'font-medium text-red-600' : 'text-stone-500'}`}>{fmtDate(p.due_date)}</span>}
                  </span>
                </li>
              );
            })}
            {!nextPayments.length && <li className="text-stone-500">Nicio tranșă neplătită. Tranșele se adaugă la fiecare cheltuială.</li>}
          </ul>
          <div className="mt-3 flex justify-between border-t border-stone-100 pt-2 text-sm">
            <span className="text-stone-600">Plătit / total</span>
            <span className="font-medium tabular-nums">{money(b.paid, ev.currency)} / {money(b.total, ev.currency)}</span>
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-stone-800">De făcut acum</h3>
          {todo.length ? (
            <ul className="space-y-2">
              {todo.map((t) => (
                <li key={t.text}>
                  <Link to={t.to} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-stone-700 hover:bg-olive-50">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-clay-500" />
                    {t.text}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">Totul e la zi.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
