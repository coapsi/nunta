import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { uid } from '../lib/api.js';
import { PHASES, eventOf, fmtDate, money, taskDue, todayIso } from '../lib/calc.js';
import { ITEMS, LISTS, SCHEDULE, TASKS } from '../lib/seeds.js';
import { Button, Card, Cell, Editable, Empty, PageHeader, Select, cx } from '../components/ui.jsx';

const TABS = [
  { key: 'tasks', label: 'Checklist' },
  { key: 'schedule', label: 'Programul zilei' },
  ...Object.entries(LISTS).map(([key, l]) => ({ key, label: l.label })),
];

function Checklist() {
  const { tasks, members, settings, mutate, canEdit } = useStore();
  const [filter, setFilter] = useState('open');
  const date = eventOf(settings).date;
  const today = todayIso();
  const done = tasks.filter((t) => t.done).length;
  const save = (id, patch) => mutate({ op: 'save', table: 'tasks', row: { id, ...patch } });
  const add = (months_before) => mutate({ op: 'save', table: 'tasks', row: { id: uid(), title: '', months_before, done: false, assignee: '', sort: tasks.length } });
  const seed = () => mutate(TASKS.map(([months_before, title], i) => ({ op: 'save', table: 'tasks', row: { id: uid(), title, months_before, done: false, assignee: '', sort: i } })));

  if (!tasks.length)
    return (
      <Empty title="Checklistul e gol">
        Pornește de la lista recomandată: tot ce e de făcut, din momentul în care alegi locația până după nuntă.
        {canEdit && (
          <div className="mt-4">
            <Button onClick={seed}>Adaugă lista recomandată</Button>
          </div>
        )}
      </Empty>
    );

  return (
    <div>
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex justify-between text-xs text-stone-500">
              <span>
                {done} din {tasks.length} făcute
              </span>
              <span>{Math.round((done / tasks.length) * 100)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full bg-olive-500" style={{ width: `${(done / tasks.length) * 100}%` }} />
            </div>
          </div>
          <Select className="!w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="open">De făcut</option>
            <option value="all">Toate</option>
            <option value="done">Făcute</option>
          </Select>
        </div>
        {!date && <p className="mt-2 text-xs text-clay-600">Pune data nunții în Setări și fiecare sarcină primește automat un termen.</p>}
      </Card>

      <Editable canEdit={canEdit} className="space-y-4">
        {PHASES.map((ph) => {
          const all = tasks.filter((t) => Number(t.months_before) === ph.key);
          const list = all.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done));
          if (!list.length && filter !== 'all') return null;
          return (
            <Card key={ph.key} className="p-0">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
                <div className="text-sm font-semibold text-stone-800">
                  {ph.label}
                  <span className="ml-2 text-xs font-normal text-stone-400">
                    {all.filter((t) => t.done).length}/{all.length}
                  </span>
                </div>
                <button className="text-xs font-medium text-olive-700 hover:underline" onClick={() => add(ph.key)}>
                  + sarcină
                </button>
              </div>
              {list.map((t) => {
                const due = taskDue(t, date);
                const late = !t.done && due && due < today;
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-x-2 border-b border-stone-50 px-3 py-1 last:border-0">
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-olive-600" checked={!!t.done} onChange={(e) => save(t.id, { done: e.target.checked })} />
                    <Cell className={cx('min-w-0 flex-1 basis-56', t.done && 'text-stone-400 line-through')} value={t.title} placeholder="Ce e de făcut" onCommit={(v) => save(t.id, { title: v })} />
                    <label className={cx('flex items-center gap-1 text-xs', late ? 'font-medium text-red-600' : 'text-stone-500')} title="Termen. Îl poți schimba.">
                      {due ? fmtDate(due) : 'fără termen'}
                      <input type="date" className="w-5 opacity-50 hover:opacity-100" value={t.due_date || ''} onChange={(e) => save(t.id, { due_date: e.target.value || null })} />
                    </label>
                    <select className="rounded-md border border-transparent bg-transparent py-1 text-xs text-stone-600 hover:border-stone-200" value={t.assignee || ''} onChange={(e) => save(t.id, { assignee: e.target.value })}>
                      <option value="">Oricine</option>
                      {[...new Set([...members.map((m) => m.name), t.assignee].filter(Boolean))].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                    <button className="px-1 text-stone-300 hover:text-red-600" onClick={() => mutate({ op: 'delete', table: 'tasks', id: t.id })}>
                      ✕
                    </button>
                  </div>
                );
              })}
              {!list.length && <div className="px-4 py-3 text-xs text-stone-400">Nimic aici.</div>}
            </Card>
          );
        })}
      </Editable>
    </div>
  );
}

// Orele de dupa miezul noptii vin la sfarsit.
const timeKey = (t) => {
  const m = /^(\d{1,2})[:.](\d{2})/.exec(t || '');
  if (!m) return 9999;
  const h = Number(m[1]);
  return (h < 6 ? h + 24 : h) * 60 + Number(m[2]);
};

function DaySchedule() {
  const { schedule, vendors, settings, mutate, canEdit } = useStore();
  const ev = eventOf(settings);
  const list = useMemo(() => [...schedule].sort((a, b) => timeKey(a.time) - timeKey(b.time) || a.sort - b.sort), [schedule]);
  const save = (id, patch) => mutate({ op: 'save', table: 'schedule', row: { id, ...patch } });
  const add = () => mutate({ op: 'save', table: 'schedule', row: { id: uid(), time: '', title: '', who: '', notes: '', sort: schedule.length } });
  const seed = () => mutate(SCHEDULE.map(([time, title, who], i) => ({ op: 'save', table: 'schedule', row: { id: uid(), time, title, who, notes: '', sort: i } })));
  const contacts = vendors.filter((v) => v.phone || v.contact);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        {!schedule.length ? (
          <Empty title="Programul zilei e gol">
            Pornește de la un program tipic și potrivește orele. Îl poți trimite apoi furnizorilor și nașilor.
            {canEdit && (
              <div className="mt-4">
                <Button onClick={seed}>Adaugă un program tipic</Button>
              </div>
            )}
          </Empty>
        ) : (
          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
              <div className="text-sm font-semibold text-stone-800">{ev.date ? fmtDate(ev.date) : 'Ziua nunții'}</div>
              <div className="flex gap-3">
                <button className="no-print text-xs font-medium text-stone-500 hover:underline" onClick={() => window.print()}>
                  Printează
                </button>
                {canEdit && (
                  <button className="no-print text-xs font-medium text-olive-700 hover:underline" onClick={add}>
                    + moment
                  </button>
                )}
              </div>
            </div>
            <Editable canEdit={canEdit}>
            {list.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-1 border-b border-stone-50 px-3 py-1 last:border-0">
                <Cell className="!w-16 font-semibold tabular-nums text-olive-800" value={r.time} placeholder="00:00" onCommit={(v) => save(r.id, { time: v })} />
                <Cell className="min-w-0 flex-1 basis-48" value={r.title} placeholder="Ce se întâmplă" onCommit={(v) => save(r.id, { title: v })} />
                <Cell className="!w-36 text-xs text-stone-500" value={r.who} placeholder="Cine" onCommit={(v) => save(r.id, { who: v })} />
                <Cell className="!w-44 text-xs text-stone-500" value={r.notes} placeholder="Notițe" onCommit={(v) => save(r.id, { notes: v })} />
                <button className="no-print px-1 text-stone-300 hover:text-red-600" onClick={() => mutate({ op: 'delete', table: 'schedule', id: r.id })}>
                  ✕
                </button>
              </div>
            ))}
            </Editable>
          </Card>
        )}
        <p className="mt-2 text-xs text-stone-500">Momentele se ordonează singure după oră. Orele din programul tipic sunt orientative.</p>
      </div>
      <Card className="self-start p-4">
        <div className="mb-2 text-sm font-semibold text-stone-800">Contacte pentru ziua nunții</div>
        {(ev.venue || ev.address) && (
          <div className="mb-3 rounded-lg bg-olive-50 p-2.5 text-sm text-olive-900">
            <div className="font-medium">{ev.venue}</div>
            <div className="text-xs">{ev.address}</div>
          </div>
        )}
        {!contacts.length && <div className="text-xs text-stone-500">Telefoanele furnizorilor apar aici după ce le treci în pagina Furnizori.</div>}
        {contacts.map((v) => (
          <div key={v.id} className="flex items-center justify-between border-t border-stone-100 py-1.5 text-sm">
            <div className="min-w-0">
              <div className="truncate text-stone-800">{v.name || v.category}</div>
              <div className="truncate text-xs text-stone-500">
                {v.category}
                {v.contact && ` · ${v.contact}`}
              </div>
            </div>
            {v.phone && (
              <a href={`tel:${v.phone}`} className="shrink-0 text-xs font-medium text-olive-700">
                {v.phone}
              </a>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

function ItemList({ list }) {
  const { items, settings, mutate, canEdit } = useStore();
  const def = LISTS[list];
  const cur = eventOf(settings).currency || 'EUR';
  const mine = items.filter((i) => i.list === list);
  const groups = [...new Set([...def.groups, ...mine.map((i) => i.grp || '')])];
  if (!groups.length) groups.push('');
  const save = (id, patch) => mutate({ op: 'save', table: 'items', row: { id, ...patch } });
  const add = (grp) => mutate({ op: 'save', table: 'items', row: { id: uid(), list, grp, title: '', note: '', link: '', done: false, sort: items.length } });
  const seedRows = ITEMS.filter((i) => i[0] === list);
  const seed = () => mutate(seedRows.map(([l, grp, title, note], i) => ({ op: 'save', table: 'items', row: { id: uid(), list: l, grp, title, note, link: '', done: false, sort: i } })));
  const total = mine.reduce((s, i) => s + (Number(i.price) || 0), 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-500">{def.hint}</p>
        <div className="flex items-center gap-3 text-xs text-stone-500">
          {def.price && <span>Total: {money(total, cur)}</span>}
          {canEdit && !mine.length && seedRows.length > 0 && (
            <Button size="sm" variant="secondary" onClick={seed}>
              Adaugă lista recomandată
            </Button>
          )}
        </div>
      </div>
      <Editable canEdit={canEdit} className="space-y-4">
        {groups.map((grp) => {
          const rows = mine.filter((i) => (i.grp || '') === grp);
          return (
            <Card key={grp || '_'} className="p-0">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
                <div className="text-sm font-semibold text-stone-800">{grp || def.label}</div>
                <button className="text-xs font-medium text-olive-700 hover:underline" onClick={() => add(grp)}>
                  + rând
                </button>
              </div>
              {!rows.length && <div className="px-4 py-3 text-xs text-stone-400">Nimic aici încă.</div>}
              {rows.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-x-1 border-b border-stone-50 px-3 py-1 last:border-0">
                  <input type="checkbox" className="h-4 w-4 shrink-0 accent-olive-600" checked={!!i.done} onChange={(e) => save(i.id, { done: e.target.checked })} />
                  <Cell className={cx('min-w-0 flex-1 basis-56', i.done && 'text-stone-400 line-through')} value={i.title} placeholder="Scrie aici" onCommit={(v) => save(i.id, { title: v })} />
                  <Cell className="min-w-0 flex-1 basis-48 text-stone-600" value={i.note} placeholder={def.note} onCommit={(v) => save(i.id, { note: v })} />
                  {def.price && (
                    <>
                      <Cell className="!w-20" type="number" value={i.price ?? ''} placeholder="Preț" onCommit={(v) => save(i.id, { price: v })} />
                      <Cell className="!w-32 text-xs" value={i.link} placeholder="Link" onCommit={(v) => save(i.id, { link: v })} />
                      {i.link && (
                        <a className="text-xs font-medium text-olive-700" href={i.link.startsWith('http') ? i.link : `https://${i.link}`} target="_blank" rel="noreferrer">
                          Deschide
                        </a>
                      )}
                    </>
                  )}
                  <button className="px-1 text-stone-300 hover:text-red-600" onClick={() => mutate({ op: 'delete', table: 'items', id: i.id })}>
                    ✕
                  </button>
                </div>
              ))}
            </Card>
          );
        })}
      </Editable>
    </div>
  );
}

export default function Plan() {
  const [tab, setTab] = useState('tasks');
  return (
    <div>
      <PageHeader title="Planificare" subtitle="Ce e de făcut, programul zilei și listele pentru DJ, fotograf, acte și cumpărături." />
      <div className="no-print mb-5 flex gap-1 overflow-x-auto border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === t.key ? 'border-olive-600 text-olive-800' : 'border-transparent text-stone-500 hover:text-stone-800')}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'tasks' ? <Checklist /> : tab === 'schedule' ? <DaySchedule /> : <ItemList key={tab} list={tab} />}
    </div>
  );
}
