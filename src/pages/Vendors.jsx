import React, { useMemo } from 'react';
import { useStore } from '../lib/store.jsx';
import { uid } from '../lib/api.js';
import { VENDOR_STATUS, calcOf, eventOf, expenseTotal, headcount, money, scenario, withPayments } from '../lib/calc.js';
import { Badge, Button, Card, Cell, Empty, PageHeader, Select, Stat } from '../components/ui.jsx';
import Payments from '../components/Payments.jsx';

const CATEGORIES = ['Locație', 'DJ', 'Fotograf', 'Videograf', 'Florist și decor', 'Tort și candy bar', 'Rochie', 'Costum', 'Verighete', 'Machiaj și coafură', 'Biserică', 'Transport', 'Altele'];
const TONE = { cautam: 'amber', oferta: 'clay', rezervat: 'green', contract: 'green', gata: 'stone' };

export default function Vendors() {
  const { vendors, expenses: raw, payments, invitations, guests, tables, settings, mutate } = useStore();
  const cur = eventOf(settings).currency || 'EUR';
  const expenses = useMemo(() => withPayments(raw, payments), [raw, payments]);
  const s = useMemo(
    () => scenario(calcOf(settings), headcount(invitations, guests), tables.filter((t) => t.shape !== 'zone').length),
    [settings, invitations, guests, tables],
  );
  const save = (id, patch) => mutate({ op: 'save', table: 'vendors', row: { id, ...patch } });
  const add = () => mutate({ op: 'save', table: 'vendors', row: { id: uid(), category: 'Altele', name: '', status: 'cautam', sort: vendors.length } });

  const linked = expenses.filter((e) => e.vendor_id);
  const total = linked.reduce((sum, e) => sum + expenseTotal(e, s), 0);
  const paid = linked.reduce((sum, e) => sum + (Number(e.paid) || 0), 0);
  const free = expenses.filter((e) => !e.vendor_id);

  return (
    <div>
      <PageHeader title="Furnizori" subtitle="Contacte, contracte și plăți. Cheltuielile legate aici sunt aceleași din Buget.">
        <Button onClick={add}>+ Furnizor</Button>
      </PageHeader>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Furnizori" value={vendors.length} sub={`${vendors.filter((v) => ['rezervat', 'contract', 'gata'].includes(v.status)).length} rezervați`} />
        <Stat label="Total la furnizori" value={money(total, cur)} sub={`pentru ${s.adults} adulți, ${s.children} copii`} />
        <Stat label="Plătit" value={money(paid, cur)} tone="good" />
        <Stat label="Rămas" value={money(total - paid, cur)} tone="clay" />
      </div>

      {!vendors.length ? (
        <Empty title="Niciun furnizor încă">Adaugă locația, DJ-ul, fotograful și restul. La fiecare legi cheltuielile din buget și tranșele de plată.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {vendors.map((v) => {
            const mine = expenses.filter((e) => e.vendor_id === v.id);
            const vTotal = mine.reduce((sum, e) => sum + expenseTotal(e, s), 0);
            const vPaid = mine.reduce((sum, e) => sum + (Number(e.paid) || 0), 0);
            return (
              <Card key={v.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Cell className="!w-auto min-w-0 flex-1 !text-base font-semibold" value={v.name} placeholder="Numele furnizorului" onCommit={(x) => save(v.id, { name: x })} />
                  <Badge tone={TONE[v.status]}>{VENDOR_STATUS[v.status] || v.status}</Badge>
                  <button
                    className="text-stone-300 hover:text-red-600"
                    title="Șterge furnizorul"
                    onClick={() => window.confirm(`Ștergi furnizorul „${v.name || v.category}”? Cheltuielile lui rămân în buget.`) && mutate({ op: 'delete', table: 'vendors', id: v.id })}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Select className="!py-1.5 !text-xs" value={v.category} onChange={(e) => save(v.id, { category: e.target.value })}>
                    {[...new Set([...CATEGORIES, v.category])].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                  <Select className="!py-1.5 !text-xs" value={v.status} onChange={(e) => save(v.id, { status: e.target.value })}>
                    {Object.entries(VENDOR_STATUS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-2 text-sm">
                  <Cell value={v.contact} placeholder="Persoană de contact" onCommit={(x) => save(v.id, { contact: x })} />
                  <Cell value={v.phone} placeholder="Telefon" onCommit={(x) => save(v.id, { phone: x })} />
                  <Cell value={v.email} placeholder="Email" onCommit={(x) => save(v.id, { email: x })} />
                  <Cell value={v.link} placeholder="Site sau Instagram" onCommit={(x) => save(v.id, { link: x })} />
                  <Cell className="col-span-2" value={v.contract_url} placeholder="Link către contract sau ofertă" onCommit={(x) => save(v.id, { contract_url: x })} />
                </div>
                <textarea
                  className="mt-1 w-full rounded-md border border-transparent bg-stone-50 px-2 py-1.5 text-sm text-stone-700 hover:border-stone-200 focus:border-olive-500 focus:bg-white focus:outline-none"
                  rows={v.notes ? Math.min(8, v.notes.split('\n').length + 1) : 2}
                  placeholder="Notițe: ce include oferta, condiții, ce ați vorbit"
                  defaultValue={v.notes}
                  key={v.id + (v.notes || '').length}
                  onBlur={(e) => e.target.value !== v.notes && save(v.id, { notes: e.target.value })}
                />
                {(v.phone || v.link || v.contract_url) && (
                  <div className="mt-1 flex flex-wrap gap-3 text-xs font-medium text-olive-700">
                    {v.phone && <a href={`tel:${v.phone}`}>Sună</a>}
                    {v.link && <a href={v.link.startsWith('http') ? v.link : `https://${v.link}`} target="_blank" rel="noreferrer">Deschide site</a>}
                    {v.contract_url && <a href={v.contract_url} target="_blank" rel="noreferrer">Deschide contract</a>}
                  </div>
                )}

                <div className="mt-3 border-t border-stone-100 pt-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-stone-600">Cheltuieli din buget</span>
                    <span className="tabular-nums text-stone-500">
                      {money(vPaid, cur)} plătit din {money(vTotal, cur)}
                    </span>
                  </div>
                  {mine.map((e) => (
                    <div key={e.id} className="mb-2 rounded-lg bg-stone-50 p-2.5">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-stone-800">{e.name || 'Fără nume'}</span>
                        <span className="flex items-center gap-2 tabular-nums text-stone-700">
                          {money(expenseTotal(e, s), cur)}
                          <button className="text-xs text-stone-400 hover:text-red-600" title="Dezleagă de furnizor" onClick={() => mutate({ op: 'save', table: 'expenses', row: { id: e.id, vendor_id: null } })}>
                            ✕
                          </button>
                        </span>
                      </div>
                      <Payments expense={e} currency={cur} total={expenseTotal(e, s)} />
                    </div>
                  ))}
                  {free.length > 0 && (
                    <Select className="!py-1.5 !text-xs" value="" onChange={(e) => e.target.value && mutate({ op: 'save', table: 'expenses', row: { id: e.target.value, vendor_id: v.id } })}>
                      <option value="">+ Leagă o cheltuială din buget</option>
                      {free.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.category}: {e.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
