import React, { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { uid } from '../lib/api.js';
import { SHAPES, SEAT_R, layout, initials } from '../lib/tables.js';
import { Badge, Button, Card, Editable, Field, Input, Modal, PageHeader, Select } from '../components/ui.jsx';
import { SIDES } from './Guests.jsx';

const CANVAS = { w: 2600, h: 1700 };
const SIDE_COLOR = { mire: '#5b7fa6', mireasa: '#c2693f', comun: '#6f874d' };

function TableShape({ t, lay, selected }) {
  const stroke = selected ? '#566b3a' : '#a8a29e';
  const fill = selected ? '#e6ebdb' : '#f5f5f4';
  if (t.shape === 'zone')
    return <rect x={-lay.w / 2} y={-lay.h / 2} width={lay.w} height={lay.h} rx="10" fill={selected ? '#f6e5d9' : '#fbf4ef'} stroke={selected ? '#c2693f' : '#e0a684'} strokeWidth="2" strokeDasharray="8 6" />;
  if (t.shape === 'serpentine')
    return (
      <>
        <path d={lay.path} fill="none" stroke={stroke} strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" />
        <path d={lay.path} fill="none" stroke={fill} strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  if (t.shape === 'rect' || t.shape === 'presidium')
    return <rect x={-lay.w / 2} y={-lay.h / 2} width={lay.w} height={lay.h} rx="8" fill={fill} stroke={stroke} strokeWidth="2" />;
  return <circle r={lay.r} fill={fill} stroke={stroke} strokeWidth="2" />;
}

export default function Seating() {
  const { tables, guests, invitations, mutate, canEdit } = useStore();
  const [selectedId, setSelectedId] = useState(null);
  const [picked, setPicked] = useState(null); // invitatul ales din lista, urmeaza sa fie asezat
  const [zoom, setZoom] = useState(0.8);
  const [search, setSearch] = useState('');
  const [sideFilter, setSideFilter] = useState('');
  const [drag, setDrag] = useState(null); // { id, x, y }
  const [listOpen, setListOpen] = useState(false);
  const [seatPick, setSeatPick] = useState(null); // { tableId, seat }
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const invById = useMemo(() => Object.fromEntries(invitations.map((i) => [i.id, i])), [invitations]);
  // Persoanele care pot fi asezate: cele care nu au refuzat.
  const people = useMemo(
    () => guests.filter((g) => g.attending !== false && invById[g.invitation_id]?.status !== 'no'),
    [guests, invById],
  );
  const seatMap = useMemo(() => {
    const m = new Map();
    for (const g of people) if (g.table_id != null && g.seat != null) m.set(`${g.table_id}:${g.seat}`, g);
    return m;
  }, [people]);
  const unseated = useMemo(() => {
    const s = search.trim().toLowerCase();
    return people
      .filter((g) => !g.table_id)
      .filter((g) => !sideFilter || invById[g.invitation_id]?.side === sideFilter)
      .filter((g) => !s || g.name.toLowerCase().includes(s) || invById[g.invitation_id]?.name.toLowerCase().includes(s))
      .sort((a, b) => (invById[a.invitation_id]?.name || '').localeCompare(invById[b.invitation_id]?.name || '', 'ro') || a.sort - b.sort);
  }, [people, search, sideFilter, invById]);

  const selected = tables.find((t) => t.id === selectedId) || null;
  const totalSeats = tables.reduce((s, t) => s + (t.shape === 'zone' ? 0 : Number(t.seats) || 0), 0);
  const seatedCount = people.filter((g) => g.table_id).length;

  function addTable(shape) {
    const n = tables.filter((t) => t.shape !== 'zone').length + 1;
    const id = uid();
    const base = { id, shape, x: 300 + ((tables.length * 90) % 900), y: 260 + ((tables.length * 70) % 500), rotation: 0, sort: tables.length };
    const row =
      shape === 'zone'
        ? { ...base, name: 'Ring de dans', seats: 0, config: { w: 260, h: 200 } }
        : shape === 'serpentine'
          ? { ...base, name: `Masa ${n}`, seats: 30, config: { curves: 3 } }
          : shape === 'presidium'
            ? { ...base, name: 'Prezidiu', seats: 6, config: {} }
            : { ...base, name: `Masa ${n}`, seats: shape === 'rect' ? 12 : 10, config: {} };
    mutate({ op: 'save', table: 'tables', row });
    setSelectedId(id);
  }

  function assign(guest, tableId, seat) {
    if (!guest) return;
    const ops = [];
    const occupant = seatMap.get(`${tableId}:${seat}`);
    if (occupant && occupant.id !== guest.id) ops.push({ op: 'save', table: 'guests', row: { id: occupant.id, table_id: null, seat: null } });
    ops.push({ op: 'save', table: 'guests', row: { id: guest.id, table_id: tableId, seat } });
    mutate(ops);
    setPicked(null);
  }

  function firstFree(t) {
    for (let i = 0; i < t.seats; i++) if (!seatMap.has(`${t.id}:${i}`)) return i;
    return -1;
  }

  function assignToTable(guest, t) {
    if (t.shape === 'zone') return;
    const seat = firstFree(t);
    if (seat >= 0) assign(guest, t.id, seat);
  }

  // Aseaza toata invitatia (familia) pe locurile libere ale mesei.
  function assignGroup(guest, t) {
    const group = people.filter((g) => g.invitation_id === guest.invitation_id && !g.table_id);
    const ops = [];
    let i = 0;
    for (const g of group) {
      while (i < t.seats && seatMap.has(`${t.id}:${i}`)) i++;
      if (i >= t.seats) break;
      ops.push({ op: 'save', table: 'guests', row: { id: g.id, table_id: t.id, seat: i } });
      i++;
    }
    mutate(ops);
    setPicked(null);
  }

  function unseat(g) {
    mutate({ op: 'save', table: 'guests', row: { id: g.id, table_id: null, seat: null } });
  }

  function updateTable(patch) {
    if (!selected) return;
    const ops = [{ op: 'save', table: 'tables', row: { id: selected.id, ...patch } }];
    if (patch.seats != null)
      for (const g of people) if (g.table_id === selected.id && g.seat >= patch.seats) ops.push({ op: 'save', table: 'guests', row: { id: g.id, table_id: null, seat: null } });
    mutate(ops);
  }

  function removeTable() {
    if (!selected) return;
    if (window.confirm(`Ștergi „${selected.name}”? Invitații de la ea rămân în listă, neașezați.`)) {
      mutate({ op: 'delete', table: 'tables', id: selected.id });
      setSelectedId(null);
    }
  }

  // ---- mutarea meselor cu mouse-ul / degetul ----
  function toCanvas(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }
  function onTableDown(e, t) {
    e.stopPropagation();
    setSelectedId(t.id);
    if (picked || !canEdit) return;
    const p = toCanvas(e);
    dragRef.current = { id: t.id, dx: p.x - t.x, dy: p.y - t.y, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const p = toCanvas(e);
    d.moved = true;
    const x = Math.round(Math.min(CANVAS.w - 40, Math.max(40, p.x - d.dx)) / 10) * 10;
    const y = Math.round(Math.min(CANVAS.h - 40, Math.max(40, p.y - d.dy)) / 10) * 10;
    setDrag({ id: d.id, x, y });
  }
  function onUp() {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.moved && drag) mutate({ op: 'save', table: 'tables', row: { id: drag.id, x: drag.x, y: drag.y } });
    setDrag(null);
  }

  function onSeatClick(e, t, seat) {
    e.stopPropagation();
    setSelectedId(t.id);
    if (!canEdit) return;
    if (picked) return assign(picked, t.id, seat);
    if (!seatMap.has(`${t.id}:${seat}`)) setSeatPick({ tableId: t.id, seat });
  }

  const dropGuest = (e) => people.find((g) => g.id === e.dataTransfer.getData('text/guest'));

  return (
    <div>
      <PageHeader title="Mese" subtitle={`${seatedCount} din ${people.length} persoane așezate · ${totalSeats} locuri în ${tables.filter((t) => t.shape !== 'zone').length} mese`}>
        <Button variant="secondary" onClick={() => setListOpen(true)} disabled={!tables.length}>
          Lista pe mese
        </Button>
        {canEdit && (
          <Select className="!w-auto" value="" onChange={(e) => e.target.value && addTable(e.target.value)}>
            <option value="">+ Adaugă masă</option>
            {Object.entries(SHAPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        )}
      </PageHeader>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* lista celor neasezati */}
        <Card className="no-print flex max-h-[38vh] w-full shrink-0 flex-col p-3 lg:max-h-[calc(100vh-190px)] lg:w-64">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-stone-800">Neașezați</div>
            <Badge tone={unseated.length ? 'amber' : 'green'}>{people.filter((g) => !g.table_id).length}</Badge>
          </div>
          <Input className="mb-2" placeholder="Caută..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select className="mb-2 !py-1.5 !text-xs" value={sideFilter} onChange={(e) => setSideFilter(e.target.value)}>
            <option value="">Toate părțile</option>
            {Object.entries(SIDES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <div className="-mx-1 flex-1 overflow-y-auto px-1">
            {!unseated.length && <div className="py-6 text-center text-xs text-stone-500">{people.length ? 'Toată lumea are loc.' : 'Adaugă invitați în pagina Invitați.'}</div>}
            {unseated.map((g) => {
              const inv = invById[g.invitation_id];
              const active = picked?.id === g.id;
              return (
                <div
                  key={g.id}
                  draggable={canEdit}
                  onDragStart={(e) => e.dataTransfer.setData('text/guest', g.id)}
                  onClick={() => canEdit && setPicked(active ? null : g)}
                  className={`mb-1 flex ${canEdit ? 'cursor-grab' : ''} items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${
                    active ? 'border-olive-500 bg-olive-50' : 'border-transparent hover:bg-stone-50'
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SIDE_COLOR[inv?.side] || '#a8a29e' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-stone-800">{g.name || 'Fără nume'}</span>
                    <span className="block truncate text-[11px] text-stone-500">
                      {inv?.name !== g.name ? inv?.name : inv?.grp || SIDES[inv?.side]}
                      {g.is_child && ' · copil'}
                      {inv?.status === 'pending' && ' · neconfirmat'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 border-t border-stone-100 pt-2 text-[11px] leading-snug text-stone-500">
            {!canEdit ? (
              'Treci cu mouse-ul peste un loc ca să vezi cine stă acolo.'
            ) : picked ? (
              <span className="font-medium text-olive-700">Apasă pe un loc sau pe o masă pentru {picked.name}.</span>
            ) : (
              'Trage un nume pe un loc sau apasă pe el și apoi pe masă.'
            )}
          </div>
        </Card>

        {/* planul salii */}
        <div className="min-w-0 flex-1">
          <div className="no-print mb-2 flex items-center gap-2 text-xs text-stone-500">
            <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}>
              −
            </Button>
            <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}>
              +
            </Button>
            <span className="ml-2 hidden sm:inline">Tragi mesele ca să le muți. Culori: </span>
            {Object.entries(SIDES).map(([k, v]) => (
              <span key={k} className="hidden items-center gap-1 sm:inline-flex">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR[k] }} />
                {v}
              </span>
            ))}
          </div>
          <div className="overflow-auto rounded-2xl border border-stone-200 bg-white shadow-sm" style={{ height: 'calc(100vh - 230px)', minHeight: 420 }}>
            <svg
              ref={svgRef}
              width={CANVAS.w * zoom}
              height={CANVAS.h * zoom}
              viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
              onClick={() => {
                setSelectedId(null);
                setPicked(null);
              }}
              style={{ touchAction: dragRef.current ? 'none' : 'auto', display: 'block' }}
            >
              <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M50 0H0V50" fill="none" stroke="#f0eeeb" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={CANVAS.w} height={CANVAS.h} fill="url(#grid)" />
              {!tables.length && (
                <text x="60" y="90" fill="#a8a29e" fontSize="26" fontFamily="Cormorant Garamond, serif">
                  Adaugă prima masă din butonul „+ Adaugă masă”.
                </text>
              )}
              {tables.map((t) => {
                const pos = drag?.id === t.id ? drag : t;
                const lay = layout(t);
                const isSel = t.id === selectedId;
                const used = lay.seats.filter((_, i) => seatMap.has(`${t.id}:${i}`)).length;
                return (
                  <g key={t.id} transform={`translate(${pos.x} ${pos.y}) rotate(${t.rotation || 0})`}>
                    <g
                      onPointerDown={(e) => onTableDown(e, t)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (picked) assignToTable(picked, t);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        assignToTable(dropGuest(e), t);
                      }}
                      style={{ cursor: picked ? 'pointer' : 'move', touchAction: 'none' }}
                    >
                      <TableShape t={t} lay={lay} selected={isSel} />
                      <g transform={`rotate(${-(t.rotation || 0)})`} style={{ pointerEvents: 'none' }}>
                        <text textAnchor="middle" y={t.shape === 'zone' ? 5 : -2} fontSize="14" fontWeight="600" fill="#44403c">
                          {t.name}
                        </text>
                        {t.shape !== 'zone' && (
                          <text textAnchor="middle" y="15" fontSize="11" fill={used > t.seats ? '#dc2626' : '#78716c'}>
                            {used}/{t.seats}
                          </text>
                        )}
                      </g>
                    </g>
                    {lay.seats.map((p, i) => {
                      const g = seatMap.get(`${t.id}:${i}`);
                      const inv = g && invById[g.invitation_id];
                      return (
                        <g
                          key={i}
                          transform={`translate(${p.x} ${p.y})`}
                          onClick={(e) => onSeatClick(e, t, i)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const guest = dropGuest(e);
                            if (guest) assign(guest, t.id, i);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle
                            r={SEAT_R}
                            fill={g ? SIDE_COLOR[inv?.side] || '#78716c' : '#fff'}
                            stroke={g ? (inv?.status === 'pending' ? '#f59e0b' : 'none') : '#d6d3d1'}
                            strokeWidth={g ? 3 : 1.5}
                            strokeDasharray={g ? 'none' : '3 3'}
                            opacity={g?.is_child ? 0.75 : 1}
                          />
                          {g && (
                            <text textAnchor="middle" y="4" fontSize="10.5" fontWeight="600" fill="#fff" transform={`rotate(${-(t.rotation || 0)})`} style={{ pointerEvents: 'none' }}>
                              {initials(g.name)}
                            </text>
                          )}
                          <title>{g ? `${g.name}${inv?.status === 'pending' ? ' (neconfirmat)' : ''}` : `Loc liber ${i + 1}`}</title>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* detaliile mesei alese */}
        {selected && (
          <Card className="no-print w-full shrink-0 p-4 lg:max-h-[calc(100vh-190px)] lg:w-72 lg:overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-stone-800">Detalii masă</div>
              <button className="text-stone-400 hover:text-stone-700" onClick={() => setSelectedId(null)}>
                ✕
              </button>
            </div>
            <Editable canEdit={canEdit}>
            <div className="space-y-3">
              <Field label="Nume">
                <Input value={selected.name} onChange={(e) => updateTable({ name: e.target.value })} />
              </Field>
              <Field label="Tip">
                <Select value={selected.shape} onChange={(e) => updateTable({ shape: e.target.value, ...(e.target.value === 'zone' ? { seats: 0, config: { w: 260, h: 200 } } : {}) })}>
                  {Object.entries(SHAPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              {selected.shape === 'zone' ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Lățime">
                    <Input type="number" step="20" min="60" value={selected.config?.w || 260} onChange={(e) => updateTable({ config: { ...selected.config, w: Number(e.target.value) || 260 } })} />
                  </Field>
                  <Field label="Înălțime">
                    <Input type="number" step="20" min="60" value={selected.config?.h || 200} onChange={(e) => updateTable({ config: { ...selected.config, h: Number(e.target.value) || 200 } })} />
                  </Field>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Locuri">
                    <Input type="number" min="1" max="120" value={selected.seats} onChange={(e) => updateTable({ seats: Math.min(120, Math.max(1, Number(e.target.value) || 1)) })} />
                  </Field>
                  <Field label="Rotire (grade)">
                    <Input type="number" step="15" value={selected.rotation || 0} onChange={(e) => updateTable({ rotation: Number(e.target.value) || 0 })} />
                  </Field>
                </div>
              )}
              {selected.shape === 'serpentine' && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Curbe">
                    <Input type="number" min="1" max="8" value={selected.config?.curves || 2} onChange={(e) => updateTable({ config: { ...selected.config, curves: Math.min(8, Math.max(1, Number(e.target.value) || 1)) } })} />
                  </Field>
                  <Field label="Adâncime curbă">
                    <Input type="number" min="20" max="200" step="10" value={selected.config?.amp || 70} onChange={(e) => updateTable({ config: { ...selected.config, amp: Number(e.target.value) || 70 } })} />
                  </Field>
                </div>
              )}
            </div>

            {selected.shape !== 'zone' && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-medium text-stone-600">Locuri</div>
                <div className="space-y-1">
                  {Array.from({ length: selected.seats }).map((_, i) => {
                    const g = seatMap.get(`${selected.id}:${i}`);
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-stone-50">
                        <span className="w-5 text-right text-xs tabular-nums text-stone-400">{i + 1}</span>
                        {g ? (
                          <>
                            <span className="min-w-0 flex-1 truncate text-stone-800">
                              {g.name}
                              {g.is_child && <span className="text-stone-400"> (copil)</span>}
                            </span>
                            <button className="text-xs text-stone-400 hover:text-red-600" onClick={() => unseat(g)} title="Ridică de la masă">
                              ✕
                            </button>
                          </>
                        ) : (
                          <button className="flex-1 text-left text-xs text-olive-700 hover:underline" onClick={() => (picked ? assign(picked, selected.id, i) : setSeatPick({ tableId: selected.id, seat: i }))}>
                            {picked ? `Așază pe ${picked.name}` : 'Alege invitat'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {picked && people.filter((g) => g.invitation_id === picked.invitation_id && !g.table_id).length > 1 && (
                  <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => assignGroup(picked, selected)}>
                    Așază toată invitația lui {picked.name}
                  </Button>
                )}
              </div>
            )}
            <Button variant="danger" size="sm" className="mt-4 w-full" onClick={removeTable}>
              Șterge {selected.shape === 'zone' ? 'zona' : 'masa'}
            </Button>
            </Editable>
          </Card>
        )}
      </div>

      {seatPick && (
        <SeatPicker
          people={people.filter((g) => !g.table_id)}
          invById={invById}
          onClose={() => setSeatPick(null)}
          onPick={(g) => {
            assign(g, seatPick.tableId, seatPick.seat);
            setSeatPick(null);
          }}
        />
      )}
      {listOpen && <SeatingList tables={tables} seatMap={seatMap} onClose={() => setListOpen(false)} />}
    </div>
  );
}

function SeatPicker({ people, invById, onClose, onPick }) {
  const [s, setS] = useState('');
  const list = people
    .filter((g) => !s || g.name.toLowerCase().includes(s.toLowerCase()) || invById[g.invitation_id]?.name.toLowerCase().includes(s.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  return (
    <Modal title="Cine stă aici?" onClose={onClose}>
      <Input autoFocus placeholder="Caută..." value={s} onChange={(e) => setS(e.target.value)} />
      <div className="mt-3 max-h-80 overflow-y-auto">
        {!list.length && <div className="py-6 text-center text-sm text-stone-500">Nu mai e nimeni neașezat.</div>}
        {list.map((g) => (
          <button key={g.id} onClick={() => onPick(g)} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-olive-50">
            <span className="text-stone-800">{g.name}</span>
            <span className="text-xs text-stone-500">{invById[g.invitation_id]?.name}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function SeatingList({ tables, seatMap, onClose }) {
  const real = tables.filter((t) => t.shape !== 'zone');
  const text = real
    .map((t) => {
      const names = Array.from({ length: t.seats }).map((_, i) => seatMap.get(`${t.id}:${i}`)?.name).filter(Boolean);
      return `${t.name} (${names.length}/${t.seats})\n${names.map((n) => `  ${n}`).join('\n')}`;
    })
    .join('\n\n');
  return (
    <Modal
      title="Lista pe mese"
      wide
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(text)}>
            Copiază textul
          </Button>
          <Button onClick={onClose}>Închide</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {real.map((t) => {
          const names = Array.from({ length: t.seats }).map((_, i) => seatMap.get(`${t.id}:${i}`));
          return (
            <div key={t.id} className="rounded-xl border border-stone-200 p-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="font-semibold text-stone-800">{t.name}</div>
                <span className="text-xs text-stone-500">
                  {names.filter(Boolean).length}/{t.seats}
                </span>
              </div>
              <ol className="list-inside list-decimal text-sm text-stone-700">
                {names.map((g, i) => (
                  <li key={i} className={g ? '' : 'text-stone-300'}>
                    {g ? g.name : 'liber'}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
