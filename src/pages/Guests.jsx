import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { uid } from '../lib/api.js';
import { eventOf, headcount, money } from '../lib/calc.js';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Stat, Textarea, Toggle } from '../components/ui.jsx';

export const SIDES = { mire: 'Mire', mireasa: 'Mireasă', comun: 'Comun' };
const STATUS = {
  pending: { label: 'Fără răspuns', tone: 'amber' },
  yes: { label: 'Vine', tone: 'green' },
  no: { label: 'Nu vine', tone: 'red' },
};
export const MENUS = { standard: 'Standard', vegetarian: 'Vegetarian', copil: 'Copil' };

export const inviteLink = (token) => `${window.location.origin}/i/${token}`;

function summary(people) {
  const adults = people.filter((p) => !p.is_child).length;
  const kids = people.length - adults;
  const parts = [];
  if (adults) parts.push(adults === 1 ? '1 adult' : `${adults} adulți`);
  if (kids) parts.push(kids === 1 ? '1 copil' : `${kids} copii`);
  return parts.join(', ') || 'nicio persoană';
}

function InvitationModal({ invitation, people, onClose }) {
  const { mutate, settings } = useStore();
  const isNew = !invitation;
  const [form, setForm] = useState(
    invitation || { id: uid(), name: '', side: 'comun', grp: '', phone: '', allow_plus_one: true, max_children: 0, notes: '', gift_amount: null },
  );
  const [persons, setPersons] = useState(people?.length ? people.map((p) => ({ ...p })) : []);
  const [removed, setRemoved] = useState([]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const currency = eventOf(settings).currency;

  function addPerson(is_child) {
    setPersons((p) => [...p, { id: uid(), name: '', is_child, kind: p.length ? 'extra' : 'primary', menu: is_child ? 'copil' : 'standard', _new: true }]);
  }

  function save() {
    const name = form.name.trim();
    if (!name) return;
    let list = persons.filter((p) => p.name.trim());
    if (isNew && !list.length) list = [{ id: uid(), name, is_child: false, kind: 'primary', menu: 'standard', _new: true }];
    const ops = [
      {
        op: 'save',
        table: 'invitations',
        row: {
          id: form.id,
          name,
          side: form.side,
          grp: form.grp.trim(),
          phone: form.phone.trim(),
          allow_plus_one: !!form.allow_plus_one,
          max_children: Number(form.max_children) || 0,
          notes: form.notes || '',
          gift_amount: form.gift_amount === '' || form.gift_amount == null ? null : Number(form.gift_amount),
          ...(isNew ? { status: 'pending' } : {}),
        },
      },
      ...list.map((p, i) => ({
        op: 'save',
        table: 'guests',
        row: {
          id: p.id,
          invitation_id: form.id,
          name: p.name.trim(),
          is_child: !!p.is_child,
          menu: p.menu || (p.is_child ? 'copil' : 'standard'),
          sort: i,
          ...(p._new ? { kind: p.kind || 'extra', attending: form.status === 'yes' ? true : form.status === 'no' ? false : null } : {}),
        },
      })),
      ...removed.map((id) => ({ op: 'delete', table: 'guests', id })),
      ...persons.filter((p) => !p.name.trim() && !p._new).map((p) => ({ op: 'delete', table: 'guests', id: p.id })),
    ];
    mutate(ops);
    onClose();
  }

  return (
    <Modal
      title={isNew ? 'Invitație nouă' : 'Editează invitația'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Renunță
          </Button>
          <Button onClick={save} disabled={!form.name.trim()}>
            Salvează
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Numele de pe invitație" hint="Așa îi apare invitatului: „Dragă ...”. Ex: Andrei, Familia Popescu, Ioana și Mihai.">
          <Input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Andrei Popescu" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Din partea">
            <Select value={form.side} onChange={(e) => set('side', e.target.value)}>
              {Object.entries(SIDES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Grup">
            <Input value={form.grp} onChange={(e) => set('grp', e.target.value)} placeholder="Familie, prieteni, colegi" list="grupuri" />
          </Field>
        </div>
        <Field label="Telefon (pentru WhatsApp)">
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="07..." />
        </Field>

        <div>
          <div className="mb-1 text-xs font-medium text-stone-600">Persoane pe această invitație</div>
          <div className="space-y-2">
            {persons.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <Input
                  value={p.name}
                  placeholder={p.is_child ? 'Numele copilului' : 'Nume și prenume'}
                  onChange={(e) => setPersons((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <Badge tone={p.is_child ? 'clay' : 'stone'}>{p.is_child ? 'copil' : p.kind === 'plus_one' ? 'însoțitor' : 'adult'}</Badge>
                <button
                  className="px-1 text-stone-400 hover:text-red-600"
                  title="Scoate persoana"
                  onClick={() => {
                    if (!p._new) setRemoved((r) => [...r, p.id]);
                    setPersons((list) => list.filter((_, j) => j !== i));
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => addPerson(false)}>
              + Adult
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addPerson(true)}>
              + Copil
            </Button>
          </div>
          {isNew && !persons.length && <p className="mt-1.5 text-xs text-stone-500">Dacă nu adaugi nimic, se creează o persoană cu numele de pe invitație.</p>}
        </div>

        <div className="rounded-xl bg-stone-50 p-3">
          <div className="mb-2 text-xs font-medium text-stone-600">Ce poate alege invitatul când confirmă</div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Toggle checked={!!form.allow_plus_one} onChange={(v) => set('allow_plus_one', v)} label="Poate veni cu însoțitor (+1)" />
            <label className="flex items-center gap-2 text-sm text-stone-700">
              Copii, cel mult
              <Select className="!w-20" value={form.max_children} onChange={(e) => set('max_children', Number(e.target.value))}>
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>

        <Field label="Notițe (doar pentru voi)">
          <Textarea rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {!isNew && (
          <Field label={`Dar primit (${currency})`} hint="Completezi după nuntă, ca să vezi rezultatul real în Buget.">
            <Input type="number" min="0" value={form.gift_amount ?? ''} onChange={(e) => set('gift_amount', e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function BulkModal({ onClose }) {
  const { mutate, notify } = useStore();
  const [text, setText] = useState('');
  const [side, setSide] = useState('comun');
  const [grp, setGrp] = useState('');
  const [plus, setPlus] = useState(true);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  function save() {
    const ops = [];
    for (const line of lines) {
      const [name, phone = ''] = line.split(/[,;\t]/).map((s) => s.trim());
      if (!name) continue;
      const id = uid();
      ops.push({ op: 'save', table: 'invitations', row: { id, name, phone, side, grp: grp.trim(), allow_plus_one: plus, max_children: 0, status: 'pending' } });
      ops.push({ op: 'save', table: 'guests', row: { id: uid(), invitation_id: id, name, kind: 'primary', is_child: false, menu: 'standard', sort: 0 } });
    }
    mutate(ops);
    notify(`Am adăugat ${ops.length / 2} invitații.`);
    onClose();
  }

  return (
    <Modal
      title="Adaugă mai mulți invitați"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Renunță
          </Button>
          <Button onClick={save} disabled={!lines.length}>
            Adaugă {lines.length || ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Câte un invitat pe rând" hint="Opțional, pui telefonul după virgulă: Andrei Popescu, 0722123456">
          <Textarea rows={8} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={'Andrei Popescu\nIoana Marin, 0722123456'} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Din partea">
            <Select value={side} onChange={(e) => setSide(e.target.value)}>
              {Object.entries(SIDES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Grup">
            <Input value={grp} onChange={(e) => setGrp(e.target.value)} placeholder="Familie, prieteni" list="grupuri" />
          </Field>
        </div>
        <Toggle checked={plus} onChange={setPlus} label="Toți pot veni cu însoțitor (+1)" />
      </div>
    </Modal>
  );
}

export default function Guests() {
  const { invitations, guests, tables, settings, mutate, notify } = useStore();
  const [editing, setEditing] = useState(null); // 'new' | invitation
  const [bulk, setBulk] = useState(false);
  const [search, setSearch] = useState('');
  const [side, setSide] = useState('');
  const [status, setStatus] = useState('');
  const [group, setGroup] = useState('');
  const ev = eventOf(settings);

  const byInv = useMemo(() => {
    const m = new Map();
    for (const g of guests) {
      if (!m.has(g.invitation_id)) m.set(g.invitation_id, []);
      m.get(g.invitation_id).push(g);
    }
    return m;
  }, [guests]);
  const tableName = useMemo(() => Object.fromEntries(tables.map((t) => [t.id, t.name])), [tables]);
  const groups = useMemo(() => [...new Set(invitations.map((i) => i.grp).filter(Boolean))].sort(), [invitations]);
  const counts = useMemo(() => headcount(invitations, guests), [invitations, guests]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return invitations
      .filter((i) => {
        if (side && i.side !== side) return false;
        if (status === 'unsent' ? i.sent_at : status && i.status !== status) return false;
        if (group && i.grp !== group) return false;
        if (!s) return true;
        return i.name.toLowerCase().includes(s) || (byInv.get(i.id) || []).some((g) => g.name.toLowerCase().includes(s));
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }, [invitations, byInv, search, side, status, group]);

  function setInvStatus(inv, value) {
    const people = byInv.get(inv.id) || [];
    const ops = [{ op: 'save', table: 'invitations', row: { id: inv.id, status: value, responded_at: value === 'pending' ? null : new Date().toISOString() } }];
    for (const g of people) {
      if (value === 'yes') ops.push({ op: 'save', table: 'guests', row: { id: g.id, attending: true } });
      if (value === 'no') ops.push({ op: 'save', table: 'guests', row: { id: g.id, attending: false, table_id: null, seat: null } });
      if (value === 'pending') ops.push({ op: 'save', table: 'guests', row: { id: g.id, attending: null } });
    }
    mutate(ops);
  }

  function message(inv) {
    const names = [ev.bride, ev.groom].filter(Boolean).join(' și ');
    return `Dragă ${inv.name}, te invităm cu drag la nunta noastră${names ? ` (${names})` : ''}! Aici găsești invitația și poți confirma prezența: ${inviteLink(inv.token)}`;
  }

  async function copyLink(inv) {
    if (!inv.token) return;
    try {
      await navigator.clipboard.writeText(inviteLink(inv.token));
      notify('Link copiat.');
    } catch {
      window.prompt('Copiază linkul:', inviteLink(inv.token));
    }
  }

  function whatsapp(inv) {
    if (!inv.token) return;
    let phone = (inv.phone || '').replace(/\D/g, '');
    if (phone.startsWith('07')) phone = '4' + phone;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message(inv))}`, '_blank');
    if (!inv.sent_at) mutate({ op: 'save', table: 'invitations', row: { id: inv.id, sent_at: new Date().toISOString() } });
  }

  function remove(inv) {
    if (window.confirm(`Ștergi invitația „${inv.name}” cu toate persoanele de pe ea?`)) mutate({ op: 'delete', table: 'invitations', id: inv.id });
  }

  function exportCsv() {
    const rows = [['Invitație', 'Persoană', 'Tip', 'Din partea', 'Grup', 'Telefon', 'Răspuns', 'Meniu', 'Masă', 'Link invitație']];
    for (const inv of invitations) {
      for (const g of byInv.get(inv.id) || []) {
        rows.push([
          inv.name,
          g.name,
          g.is_child ? 'copil' : 'adult',
          SIDES[inv.side] || '',
          inv.grp,
          inv.phone,
          inv.status === 'no' || g.attending === false ? 'nu vine' : inv.status === 'yes' ? 'vine' : 'fără răspuns',
          MENUS[g.menu] || g.menu,
          tableName[g.table_id] || '',
          inviteLink(inv.token),
        ]);
      }
    }
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'invitati-nunta.csv';
    a.click();
  }

  return (
    <div>
      <datalist id="grupuri">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <PageHeader title="Invitați" subtitle="Fiecare invitație are linkul ei, cu numele invitatului și confirmare directă.">
        <Button variant="secondary" onClick={exportCsv} disabled={!invitations.length}>
          Export CSV
        </Button>
        <Button variant="secondary" onClick={() => setBulk(true)}>
          Adaugă mai mulți
        </Button>
        <Button onClick={() => setEditing('new')}>+ Invitație</Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Invitații" value={counts.invitations} sub={`${counts.totalListed} persoane trecute`} />
        <Stat label="Vin" value={counts.confirmed} tone="good" sub={`${counts.confirmedAdults} adulți, ${counts.confirmedChildren} copii`} />
        <Stat label="Fără răspuns" value={counts.pending} tone="clay" sub={`${counts.invPending} invitații, +${counts.pendingPlusOnes} însoțitori posibili`} />
        <Stat label="Nu vin" value={counts.declined} sub={`${counts.invNo} invitații refuzate`} />
        <Stat label="Daruri primite" value={money(invitations.reduce((s, i) => s + (Number(i.gift_amount) || 0), 0), ev.currency)} sub="completate pe invitații" />
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap gap-2">
          <Input className="!w-full sm:!w-64" placeholder="Caută după nume..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select className="!w-auto" value={side} onChange={(e) => setSide(e.target.value)}>
            <option value="">Toate părțile</option>
            {Object.entries(SIDES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select className="!w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Orice răspuns</option>
            <option value="yes">Vin</option>
            <option value="pending">Fără răspuns</option>
            <option value="no">Nu vin</option>
            <option value="unsent">Invitație netrimisă</option>
          </Select>
          {groups.length > 0 && (
            <Select className="!w-auto" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">Toate grupurile</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          )}
          <div className="ml-auto self-center text-xs text-stone-500">{filtered.length} afișate</div>
        </div>
      </Card>

      {!invitations.length ? (
        <Empty title="Încă nu ai niciun invitat">Adaugă prima invitație sau lipește toată lista dintr-o dată cu „Adaugă mai mulți”.</Empty>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const people = byInv.get(inv.id) || [];
            const st = STATUS[inv.status] || STATUS.pending;
            return (
              <Card key={inv.id} className="p-3.5">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-stone-900">{inv.name}</span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <Badge>{SIDES[inv.side]}</Badge>
                      {inv.grp && <Badge>{inv.grp}</Badge>}
                      {!inv.sent_at && <Badge tone="clay">netrimisă</Badge>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {people.map((g) => (
                        <span
                          key={g.id}
                          className={`rounded-md border px-2 py-0.5 text-xs ${
                            g.attending === false ? 'border-stone-200 text-stone-400 line-through' : 'border-stone-200 bg-stone-50 text-stone-700'
                          }`}
                        >
                          {g.name}
                          {g.is_child && ' (copil)'}
                          {g.kind === 'plus_one' && ' (+1)'}
                          {g.menu === 'vegetarian' && ' · vegetarian'}
                          {g.table_id && <span className="text-olive-700"> · {tableName[g.table_id]}</span>}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1.5 text-xs text-stone-500">
                      {summary(people)}
                      {inv.allow_plus_one && inv.status === 'pending' && !people.some((g) => g.kind === 'plus_one') && ' · poate aduce +1'}
                      {inv.max_children > 0 && ` · copii: max ${inv.max_children}`}
                      {inv.gift_amount != null && ` · dar: ${money(inv.gift_amount, ev.currency)}`}
                    </div>
                    {inv.message && <div className="mt-1.5 rounded-lg bg-olive-50 px-2.5 py-1.5 text-xs text-olive-900">„{inv.message}”</div>}
                    {inv.notes && <div className="mt-1 text-xs italic text-stone-500">{inv.notes}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Select className="!w-auto !py-1.5 !text-xs" value={inv.status} onChange={(e) => setInvStatus(inv, e.target.value)} title="Schimbă răspunsul manual">
                      <option value="pending">Fără răspuns</option>
                      <option value="yes">Vine</option>
                      <option value="no">Nu vine</option>
                    </Select>
                    <Button size="sm" variant="secondary" onClick={() => copyLink(inv)}>
                      Copiază link
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => whatsapp(inv)}>
                      WhatsApp
                    </Button>
                    <a className="rounded-lg px-2 py-1.5 text-xs font-medium text-olive-700 hover:bg-olive-50" href={`/i/${inv.token}`} target="_blank" rel="noreferrer">
                      Vezi
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(inv)}>
                      Editează
                    </Button>
                    <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => remove(inv)}>
                      Șterge
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <InvitationModal invitation={editing === 'new' ? null : editing} people={editing === 'new' ? [] : byInv.get(editing.id)} onClose={() => setEditing(null)} />
      )}
      {bulk && <BulkModal onClose={() => setBulk(false)} />}
    </div>
  );
}
