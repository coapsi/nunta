import React, { useMemo } from 'react';
import { useStore } from '../lib/store.jsx';
import { uid } from '../lib/api.js';
import { eventOf, money } from '../lib/calc.js';
import { Button, Card, Cell, Empty, PageHeader, Select, Stat } from '../components/ui.jsx';

export default function Rooms() {
  const { rooms, guests, invitations, settings, mutate } = useStore();
  const cur = eventOf(settings).currency || 'EUR';
  const invById = useMemo(() => Object.fromEntries(invitations.map((i) => [i.id, i])), [invitations]);
  const people = useMemo(() => guests.filter((g) => g.attending !== false && invById[g.invitation_id]?.status !== 'no'), [guests, invById]);
  const free = people.filter((g) => !g.room_id).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const save = (id, patch) => mutate({ op: 'save', table: 'rooms', row: { id, ...patch } });
  const add = () => mutate({ op: 'save', table: 'rooms', row: { id: uid(), name: `Camera ${rooms.length + 1}`, capacity: 2, price: 0, notes: '', sort: rooms.length } });
  const beds = rooms.reduce((s, r) => s + (Number(r.capacity) || 0), 0);
  const used = people.filter((g) => g.room_id).length;
  const cost = rooms.reduce((s, r) => s + (Number(r.price) || 0), 0);

  return (
    <div>
      <PageHeader title="Cazare" subtitle="Camerele rezervate și cine doarme în fiecare.">
        <Button onClick={add}>+ Cameră</Button>
      </PageHeader>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Camere" value={rooms.length} />
        <Stat label="Locuri" value={beds} sub={`${used} ocupate, ${Math.max(0, beds - used)} libere`} />
        <Stat label="Cost camere" value={money(cost, cur)} sub="trece suma și în Buget, la Cazare" />
        <Stat label="Invitați fără cameră" value={free.length} sub="dintre cei care vin sau nu au răspuns" />
      </div>
      {!rooms.length ? (
        <Empty title="Nicio cameră încă">Adaugă camerele de la locație sau de la o pensiune din apropiere și repartizează invitații.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => {
            const inside = people.filter((g) => g.room_id === r.id);
            const full = inside.length >= (Number(r.capacity) || 0);
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center gap-1">
                  <Cell className="min-w-0 flex-1 font-semibold" value={r.name} placeholder="Numele camerei" onCommit={(v) => save(r.id, { name: v })} />
                  <button className="text-stone-300 hover:text-red-600" onClick={() => window.confirm(`Ștergi „${r.name}”?`) && mutate({ op: 'delete', table: 'rooms', id: r.id })}>
                    ✕
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">
                  <span>Locuri</span>
                  <Cell className="!w-12" type="number" value={r.capacity} onCommit={(v) => save(r.id, { capacity: Math.max(1, Math.round(v)) })} />
                  <span>Preț ({cur})</span>
                  <Cell className="!w-16" type="number" value={r.price} onCommit={(v) => save(r.id, { price: v })} />
                </div>
                <Cell className="text-xs text-stone-500" value={r.notes} placeholder="Notițe" onCommit={(v) => save(r.id, { notes: v })} />
                <div className="mt-2 space-y-1">
                  {inside.map((g) => (
                    <div key={g.id} className="flex items-center justify-between rounded-md bg-olive-50 px-2 py-1 text-sm text-olive-900">
                      {g.name}
                      <button className="text-xs text-olive-600 hover:text-red-600" onClick={() => mutate({ op: 'save', table: 'guests', row: { id: g.id, room_id: null } })}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                {!full && (
                  <Select className="mt-2 !py-1.5 !text-xs" value="" onChange={(e) => e.target.value && mutate({ op: 'save', table: 'guests', row: { id: e.target.value, room_id: r.id } })}>
                    <option value="">+ Adaugă un invitat ({inside.length}/{r.capacity})</option>
                    {free.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                        {invById[g.invitation_id]?.name !== g.name ? ` (${invById[g.invitation_id]?.name})` : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
