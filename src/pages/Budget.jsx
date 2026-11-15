import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { uid } from '../lib/api.js';
import { EXPENSE_KINDS, EXPENSE_STATUS, budget, calcOf, eventOf, expenseTotal, headcount, money, scenario, withPayments } from '../lib/calc.js';
import Payments from '../components/Payments.jsx';
import { Button, Card, Cell, Empty, Field, PageHeader, Select, Stat, cx } from '../components/ui.jsx';

const CATEGORIES = ['Locație și meniu', 'Băuturi', 'Muzică', 'Foto și video', 'Decor și flori', 'Ținute', 'Papetărie', 'Cazare', 'Ceremonie', 'Altele'];

const TEMPLATE = [
  ['Locație și meniu', 'Meniu adult', 'per_adult'],
  ['Locație și meniu', 'Meniu copil', 'per_child'],
  ['Locație și meniu', 'Chirie locație', 'fixed'],
  ['Locație și meniu', 'Tort și candy bar', 'fixed'],
  ['Băuturi', 'Pachet băuturi', 'per_adult'],
  ['Muzică', 'DJ', 'fixed'],
  ['Foto și video', 'Fotograf', 'fixed'],
  ['Foto și video', 'Videograf', 'fixed'],
  ['Decor și flori', 'Aranjamente florale pe mese', 'per_table'],
  ['Decor și flori', 'Decor sală și buchete', 'fixed'],
  ['Ținute', 'Rochie de mireasă', 'fixed'],
  ['Ținute', 'Costum mire', 'fixed'],
  ['Ținute', 'Verighete', 'fixed'],
  ['Ținute', 'Machiaj și coafură', 'fixed'],
  ['Papetărie', 'Mărturii', 'per_person'],
  ['Papetărie', 'Meniuri, numere de masă, place carduri', 'fixed'],
  ['Cazare', 'Cazare invitați', 'fixed'],
  ['Ceremonie', 'Cununie religioasă', 'fixed'],
  ['Ceremonie', 'Cununie civilă', 'fixed'],
];

function NumberField({ label, value, onChange, suffix, hint }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center rounded-lg border border-stone-300 bg-white focus-within:border-olive-500 focus-within:ring-2 focus-within:ring-olive-200">
        <Cell type="number" value={value} onCommit={onChange} className="!border-0 !py-2 hover:!border-0" />
        {suffix && <span className="pr-3 text-xs text-stone-500">{suffix}</span>}
      </div>
    </Field>
  );
}

export default function Budget() {
  const { expenses: rawExpenses, payments, vendors, invitations, guests, tables, settings, mutate, saveSettings } = useStore();
  const expenses = useMemo(() => withPayments(rawExpenses, payments), [rawExpenses, payments]);
  const [open, setOpen] = useState(null);
  const ev = eventOf(settings);
  const calc = calcOf(settings);
  const cur = ev.currency || 'EUR';
  const setCalc = (patch) => saveSettings({ ...settings, calc: { ...calc, ...patch } });

  const counts = useMemo(() => headcount(invitations, guests), [invitations, guests]);
  const tableCount = tables.filter((t) => t.shape !== 'zone').length;
  const s = useMemo(() => scenario(calc, counts, tableCount), [calc, counts, tableCount]);
  const b = useMemo(() => budget(expenses, s, calc), [expenses, s, calc]);
  const giftsReceived = invitations.reduce((sum, i) => sum + (Number(i.gift_amount) || 0), 0);
  const giftsCount = invitations.filter((i) => i.gift_amount != null).length;

  const grouped = useMemo(() => {
    const m = new Map();
    for (const e of expenses) {
      const c = e.category || 'Altele';
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(e);
    }
    return [...m.entries()].sort((a, b) => (CATEGORIES.indexOf(a[0]) + 100) % 100 - ((CATEGORIES.indexOf(b[0]) + 100) % 100));
  }, [expenses]);

  const save = (id, patch) => mutate({ op: 'save', table: 'expenses', row: { id, ...patch } });
  const add = (category = 'Altele') =>
    mutate({ op: 'save', table: 'expenses', row: { id: uid(), category, name: '', kind: 'fixed', amount: 0, paid: 0, vendor: '', notes: '', sort: expenses.length } });
  const addTemplate = () =>
    mutate(
      TEMPLATE.map(([category, name, kind], i) => ({
        op: 'save',
        table: 'expenses',
        row: { id: uid(), category, name, kind, amount: 0, paid: 0, vendor: '', notes: '', sort: expenses.length + i },
      })),
    );

  // tabel de sensibilitate: profit in functie de darul mediu si numarul de adulti
  const gift = Number(calc.giftPerAdult) || 0;
  const giftSteps = [-100, -50, 0, 50, 100].map((d) => Math.max(0, gift + d)).filter((v, i, a) => a.indexOf(v) === i);
  const adultSteps = [0.7, 0.8, 0.9, 1, 1.1].map((f) => Math.round(s.adults * f)).filter((v, i, a) => v > 0 && a.indexOf(v) === i);
  const profitAt = (g, adults) => {
    const sc = { ...s, adults, persons: adults + s.children };
    return g * adults - budget(expenses, sc, calc).total;
  };

  return (
    <div>
      <PageHeader title="Buget" subtitle="Costuri, prag de rentabilitate și cât ar trebui să fie darul ca să ieși pe zero sau pe plus.">
        {!expenses.length && (
          <Button variant="secondary" onClick={addTemplate}>
            Adaugă cheltuielile tipice
          </Button>
        )}
        <Button onClick={() => add()}>+ Cheltuială</Button>
      </PageHeader>

      {/* scenariul de prezenta */}
      <Card className="mb-4">
        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <Field label="Pentru câți oameni calculăm">
              <Select value={calc.mode} onChange={(e) => setCalc({ mode: e.target.value })}>
                <option value="estimate">Estimare: confirmați + o parte din cei fără răspuns</option>
                <option value="confirmed">Doar cei care au confirmat</option>
                <option value="all">Toți invitații (fără cei care au refuzat)</option>
                <option value="custom">Număr ales de mine</option>
              </Select>
            </Field>
            {calc.mode === 'estimate' && (
              <Field label={`Câți dintre cei fără răspuns vin: ${calc.rate}%`} hint="Se aplică și însoțitorilor posibili (+1) de pe invitațiile fără răspuns.">
                <input type="range" min="0" max="100" step="5" value={calc.rate} onChange={(e) => setCalc({ rate: Number(e.target.value) })} className="w-full accent-olive-600" />
              </Field>
            )}
            {calc.mode === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Adulți" value={calc.customAdults} onChange={(v) => setCalc({ customAdults: v })} />
                <NumberField label="Copii" value={calc.customChildren} onChange={(v) => setCalc({ customChildren: v })} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 self-start">
            <div className="rounded-xl bg-olive-50 p-3 text-center">
              <div className="text-2xl font-semibold tabular-nums text-olive-800">{s.adults}</div>
              <div className="text-xs text-olive-700">adulți</div>
            </div>
            <div className="rounded-xl bg-clay-50 p-3 text-center">
              <div className="text-2xl font-semibold tabular-nums text-clay-700">{s.children}</div>
              <div className="text-xs text-clay-600">copii</div>
            </div>
            <div className="rounded-xl bg-stone-100 p-3 text-center">
              <div className="text-2xl font-semibold tabular-nums text-stone-800">{s.tables}</div>
              <div className="text-xs text-stone-600">{tableCount >= s.tables ? 'mese' : 'mese (estimat, 10/masă)'}</div>
            </div>
            <div className="col-span-3 text-xs text-stone-500">
              Acum: {counts.confirmedAdults} adulți și {counts.confirmedChildren} copii confirmați, {counts.pendingAdults + counts.pendingChildren} persoane fără răspuns, {counts.pendingPlusOnes} însoțitori posibili.
            </div>
          </div>
        </div>
      </Card>

      {/* cifrele mari */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cost total" value={money(b.total, cur)} sub={`fix ${money(b.fixed, cur)} · variabil ${money(b.variable, cur)}`} />
        <Stat label="Ca să ieși pe zero" value={b.breakEvenPerAdult == null ? '-' : money(b.breakEvenPerAdult, cur)} tone="clay" sub="dar mediu necesar per adult" />
        <Stat
          label="Pe zero, per invitație"
          value={b.breakEvenPerInvitation == null ? '-' : money(b.breakEvenPerInvitation, cur)}
          sub={s.payingInvitations ? `${s.payingInvitations} plicuri așteptate` : 'disponibil când ai invitații'}
        />
        <Stat label="Un adult în plus costă" value={money(b.perAdult, cur)} sub={`un copil în plus: ${money(b.perChild, cur)}`} />
      </div>

      {/* simulator de profit */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-stone-800">Simulare: ce iese la un anumit dar</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Dar mediu per adult" value={calc.giftPerAdult} onChange={(v) => setCalc({ giftPerAdult: v })} suffix={cur} />
            <NumberField label="Profit dorit" value={calc.targetProfit} onChange={(v) => setCalc({ targetProfit: v })} suffix={cur} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">Încasări estimate ({s.adults} adulți × {money(gift, cur)})</dt>
              <dd className="font-medium tabular-nums">{money(b.income, cur)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">Cost total</dt>
              <dd className="font-medium tabular-nums">− {money(b.total, cur)}</dd>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-2 text-base">
              <dt className="font-semibold text-stone-800">{b.profit >= 0 ? 'Profit' : 'Pierdere'}</dt>
              <dd className={cx('font-semibold tabular-nums', b.profit >= 0 ? 'text-olive-700' : 'text-red-600')}>{money(b.profit, cur)}</dd>
            </div>
          </dl>
          <div className="mt-4 space-y-1.5 rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
            <div>
              Pentru profit de <b>{money(Number(calc.targetProfit) || 0, cur)}</b> ai nevoie de un dar mediu de{' '}
              <b>{b.neededPerAdult == null ? '-' : money(b.neededPerAdult, cur)}</b> per adult.
            </div>
            <div>
              La un dar de {money(gift, cur)} ieși pe zero de la{' '}
              <b>{b.breakEvenAdults == null ? 'niciun număr de adulți (darul nu acoperă costul unui adult)' : `${b.breakEvenAdults} adulți`}</b>.
            </div>
            <div className="text-xs text-stone-500">Copiii sunt socotiți la costuri, dar nu la daruri.</div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-1 text-sm font-semibold text-stone-800">Profit sau pierdere, pe scenarii</h3>
          <p className="mb-3 text-xs text-stone-500">Rânduri: darul mediu per adult. Coloane: câți adulți vin (copiii rămân {s.children}).</p>
          {adultSteps.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-stone-500">Dar \ Adulți</th>
                    {adultSteps.map((a) => (
                      <th key={a} className={cx('px-2 py-1.5 text-right text-xs font-medium', a === s.adults ? 'text-olive-700' : 'text-stone-500')}>
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {giftSteps.map((g) => (
                    <tr key={g} className="border-t border-stone-100">
                      <td className={cx('px-2 py-1.5 text-xs font-medium', g === gift ? 'text-olive-700' : 'text-stone-600')}>{money(g, cur)}</td>
                      {adultSteps.map((a) => {
                        const p = profitAt(g, a);
                        return (
                          <td key={a} className={cx('px-2 py-1.5 text-right tabular-nums', p >= 0 ? 'bg-olive-50 text-olive-800' : 'bg-red-50 text-red-700')}>
                            {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(p)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-stone-500">Adaugă invitați sau alege un număr de adulți ca să vezi scenariile.</div>
          )}
        </Card>
      </div>

      {/* plati si rezultat real */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Plătit până acum" value={money(b.paid, cur)} sub={b.total > 0 ? `${Math.round((b.paid / b.total) * 100)}% din total` : undefined} />
        <Stat label="Rămas de plată" value={money(b.remaining, cur)} tone={b.remaining > 0 ? 'clay' : 'good'} />
        <Stat label="Daruri primite" value={money(giftsReceived, cur)} sub={`${giftsCount} invitații completate`} />
        <Stat
          label="Rezultat real"
          value={giftsCount ? money(giftsReceived - b.total, cur) : '-'}
          tone={giftsCount ? (giftsReceived - b.total >= 0 ? 'good' : 'bad') : undefined}
          sub="daruri primite minus cost total"
        />
      </div>

      {/* lista de cheltuieli */}
      {!expenses.length ? (
        <Empty title="Nicio cheltuială încă">
          Pornește de la lista tipică (meniu, băuturi, DJ, foto, flori) și completează sumele din ofertele primite, sau adaugă-le una câte una.
        </Empty>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Cheltuială</th>
                  <th className="px-2 py-2 text-left font-medium">Tip</th>
                  <th className="px-2 py-2 text-right font-medium">Preț ({cur})</th>
                  <th className="px-2 py-2 text-right font-medium">Total în scenariu</th>
                  <th className="px-2 py-2 text-right font-medium">Plătit</th>
                  <th className="px-2 py-2 text-right font-medium">Rest</th>
                  <th className="px-2 py-2 text-left font-medium">Notițe</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {grouped.map(([category, items]) => {
                  const catTotal = items.reduce((sum, e) => sum + expenseTotal(e, s), 0);
                  return (
                    <React.Fragment key={category}>
                      <tr className="border-t border-stone-200 bg-olive-50/50">
                        <td colSpan={3} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-olive-800">
                          {category}
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs font-semibold tabular-nums text-olive-800">{money(catTotal, cur)}</td>
                        <td colSpan={4} className="px-2 py-1.5 text-right">
                          <button className="text-xs font-medium text-olive-700 hover:underline" onClick={() => add(category)}>
                            + rând
                          </button>
                        </td>
                      </tr>
                      {items.map((e) => {
                        const t = expenseTotal(e, s);
                        const rest = t - (Number(e.paid) || 0);
                        return (
                          <React.Fragment key={e.id}>
                          <tr className="border-t border-stone-100">
                            <td className="px-1 py-0.5">
                              <div className="flex items-center">
                                <button className={cx('w-5 shrink-0 text-xs', open === e.id ? 'text-olive-700' : 'text-stone-400 hover:text-stone-700')} onClick={() => setOpen(open === e.id ? null : e.id)} title="Furnizor, stare și plăți">
                                  {open === e.id ? '▾' : '▸'}
                                </button>
                                <Cell value={e.name} placeholder="Denumire" onCommit={(v) => save(e.id, { name: v })} />
                                {e.status && e.status !== 'estimat' && <span className="ml-1 shrink-0 rounded-full bg-olive-100 px-1.5 py-0.5 text-[10px] font-medium text-olive-800">{EXPENSE_STATUS[e.status]}</span>}
                              </div>
                            </td>
                            <td className="px-1 py-0.5">
                              <div className="flex gap-1">
                                <select className="rounded-md border border-transparent bg-transparent px-1 py-1.5 text-xs hover:border-stone-200" value={e.kind} onChange={(ev2) => save(e.id, { kind: ev2.target.value })}>
                                  {Object.entries(EXPENSE_KINDS).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="w-24 rounded-md border border-transparent bg-transparent px-1 py-1.5 text-xs text-stone-500 hover:border-stone-200"
                                  value={e.category}
                                  onChange={(ev2) => save(e.id, { category: ev2.target.value })}
                                  title="Categorie"
                                >
                                  {[...new Set([...CATEGORIES, e.category])].map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="w-28 px-1 py-0.5">
                              <Cell type="number" value={e.amount} onCommit={(v) => save(e.id, { amount: v })} />
                            </td>
                            <td className="px-2 py-0.5 text-right tabular-nums text-stone-800">
                              {money(t, cur)}
                              {e.kind !== 'fixed' && (
                                <div className="text-[11px] text-stone-400">
                                  × {e.kind === 'per_adult' ? s.adults : e.kind === 'per_child' ? s.children : e.kind === 'per_person' ? s.persons : s.tables}
                                </div>
                              )}
                            </td>
                            <td className="w-28 px-1 py-0.5">
                              {e.hasPayments ? (
                                <div className="px-2 py-1.5 text-right tabular-nums text-stone-700" title="Calculat din tranșele bifate">{new Intl.NumberFormat('ro-RO').format(e.paid)}</div>
                              ) : (
                                <Cell type="number" value={e.paid} onCommit={(v) => save(e.id, { paid: v })} />
                              )}
                            </td>
                            <td className={cx('px-2 py-0.5 text-right tabular-nums', rest > 0 ? 'text-clay-600' : 'text-olive-700')}>{money(rest, cur)}</td>
                            <td className="px-1 py-0.5">
                              <Cell value={e.notes} placeholder="-" onCommit={(v) => save(e.id, { notes: v })} />
                            </td>
                            <td className="pr-2 text-right">
                              <button
                                className="text-stone-300 hover:text-red-600"
                                title="Șterge"
                                onClick={() => window.confirm(`Ștergi „${e.name || 'cheltuiala'}”?`) && mutate({ op: 'delete', table: 'expenses', id: e.id })}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                          {open === e.id && (
                            <tr className="bg-stone-50/70">
                              <td colSpan={8} className="px-4 py-3">
                                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                                  <div className="space-y-2">
                                    <Field label="Stare">
                                      <Select value={e.status || 'estimat'} onChange={(ev2) => save(e.id, { status: ev2.target.value })}>
                                        {Object.entries(EXPENSE_STATUS).map(([k, v]) => (
                                          <option key={k} value={k}>
                                            {v}
                                          </option>
                                        ))}
                                      </Select>
                                    </Field>
                                    <Field label="Furnizor">
                                      <Select value={e.vendor_id || ''} onChange={(ev2) => save(e.id, { vendor_id: ev2.target.value || null })}>
                                        <option value="">Fără furnizor</option>
                                        {vendors.map((v) => (
                                          <option key={v.id} value={v.id}>
                                            {v.name || v.category}
                                          </option>
                                        ))}
                                      </Select>
                                    </Field>
                                  </div>
                                  <Payments expense={e} currency={cur} total={t} />
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                <tr className="border-t-2 border-stone-300 bg-stone-50 font-semibold">
                  <td colSpan={3} className="px-3 py-2.5">
                    Total
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{money(b.total, cur)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{money(b.paid, cur)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{money(b.remaining, cur)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
