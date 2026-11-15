import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { rpc } from '../lib/api.js';
import { DEFAULT_EVENT } from '../lib/calc.js';

const DEFAULT_TEXT = 'Cu bucurie în suflet, te invităm să fii alături de noi în ziua în care spunem „Da” și să sărbătorim împreună începutul poveștii noastre.';

function Sprig({ className, flip }) {
  return (
    <svg viewBox="0 0 120 40" className={className} style={flip ? { transform: 'scaleX(-1)' } : undefined} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M4 20 C 40 20, 80 20, 116 20" />
      {[18, 38, 58, 78, 98].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 20 C ${x + 4} ${12 - i}, ${x + 12} ${8 - i}, ${x + 16} ${9 - i} C ${x + 13} ${15 - i}, ${x + 7} ${19}, ${x} 20`} fill="currentColor" fillOpacity=".18" />
          <path d={`M${x + 8} 20 C ${x + 12} ${28 + i}, ${x + 20} ${32 + i}, ${x + 24} ${31 + i} C ${x + 21} ${25 + i}, ${x + 15} ${21}, ${x + 8} 20`} fill="currentColor" fillOpacity=".18" />
        </g>
      ))}
    </svg>
  );
}

function Choice({ active, onClick, children, tone = 'olive' }) {
  const on = tone === 'olive' ? 'border-olive-600 bg-olive-600 text-white' : 'border-stone-500 bg-stone-600 text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full border px-4 py-3 text-sm font-medium transition-colors ${active ? on : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'}`}
    >
      {children}
    </button>
  );
}

const inputCls =
  'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-800 placeholder:text-stone-400 focus:border-olive-500 focus:outline-none focus:ring-2 focus:ring-olive-200';

export default function Invite() {
  const { token } = useParams();
  const [data, setData] = useState(undefined);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [attending, setAttending] = useState(null);
  const [persons, setPersons] = useState({}); // id -> { attending, menu }
  const [withPlus, setWithPlus] = useState(false);
  const [plusName, setPlusName] = useState('');
  const [plusMenu, setPlusMenu] = useState('standard');
  const [kids, setKids] = useState([]);
  const [message, setMessage] = useState('');

  function hydrate(d) {
    setData(d);
    const base = d.people.filter((p) => p.kind !== 'plus_one' && p.kind !== 'child_rsvp');
    setPersons(Object.fromEntries(base.map((p) => [p.id, { attending: p.attending !== false, menu: p.menu || 'standard' }])));
    const plus = d.people.find((p) => p.kind === 'plus_one');
    setWithPlus(!!plus);
    setPlusName(plus?.name || '');
    setPlusMenu(plus?.menu || 'standard');
    setKids(d.people.filter((p) => p.kind === 'child_rsvp').map((p) => p.name));
    setMessage(d.invitation.message || '');
    setAttending(d.invitation.status === 'yes' ? true : d.invitation.status === 'no' ? false : null);
    setEditing(d.invitation.status === 'pending');
  }

  useEffect(() => {
    rpc('invite.get', { token })
      .then(hydrate)
      .catch(() => setData(null));
  }, [token]);

  const ev = useMemo(() => ({ ...DEFAULT_EVENT, ...(data?.event || {}) }), [data]);
  useEffect(() => {
    const names = [ev.bride, ev.groom].filter(Boolean).join(' & ');
    if (names) document.title = `${names} · Invitație`;
  }, [ev.bride, ev.groom]);

  if (data === undefined) return <div className="flex min-h-full items-center justify-center text-sm text-stone-500">Se încarcă invitația...</div>;
  if (data === null)
    return (
      <div className="flex min-h-full items-center justify-center px-6 text-center">
        <div>
          <div className="font-display text-3xl text-stone-800">Invitația nu a fost găsită</div>
          <p className="mt-2 text-sm text-stone-500">Verifică linkul primit sau scrie-ne direct.</p>
        </div>
      </div>
    );

  const inv = data.invitation;
  const base = data.people.filter((p) => p.kind !== 'plus_one' && p.kind !== 'child_rsvp');
  const date = ev.date ? new Date(ev.date + 'T00:00:00') : null;
  const days = date ? Math.ceil((date - new Date(new Date().toDateString())) / 86400000) : null;
  const deadline = ev.rsvpDeadline ? new Date(ev.rsvpDeadline + 'T00:00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' }) : null;
  const names = [ev.bride, ev.groom].filter(Boolean);

  async function submit(e) {
    e.preventDefault();
    if (attending == null) return setError('Alege dacă vii sau nu.');
    if (attending && withPlus && !plusName.trim()) return setError('Scrie numele persoanei care te însoțește.');
    setBusy(true);
    setError('');
    try {
      const answer = {
        attending,
        people: base.map((p) => ({ id: p.id, attending: base.length > 1 ? !!persons[p.id]?.attending : true, menu: persons[p.id]?.menu })),
        plusOne: attending && withPlus ? { name: plusName.trim(), menu: plusMenu } : null,
        children: attending ? kids.map((name) => ({ name })) : [],
        message,
      };
      hydrate(await rpc('invite.rsvp', { token, answer }));
      setEditing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const answered = inv.status !== 'pending' && !editing;
  const coming = data.people.filter((p) => p.attending === true);

  return (
    <div className="min-h-full bg-[#f6f1e7] px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-xl">
        {/* invitatia */}
        <div className="relative overflow-hidden rounded-[28px] border border-[#e6dcc8] bg-[#fffdf8] px-6 py-12 text-center shadow-[0_20px_60px_-30px_rgba(86,107,58,.45)] sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-3 rounded-[20px] border border-[#e9e0cf]" />
          <Sprig className="mx-auto h-9 w-28 text-olive-500" />
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.35em] text-olive-700">Împreună cu familiile noastre</p>
          <h1 className="mt-5 font-display text-[52px] font-medium italic leading-[1.05] text-stone-800 sm:text-[68px]">
            {names.length === 2 ? (
              <>
                {names[0]}
                <span className="my-1 block text-3xl not-italic text-clay-500 sm:text-4xl">&amp;</span>
                {names[1]}
              </>
            ) : (
              names[0] || 'Nunta noastră'
            )}
          </h1>

          <div className="mx-auto mt-8 h-px w-16 bg-clay-300" />
          <p className="mt-8 font-display text-2xl text-stone-700">Dragă {inv.name},</p>
          <p className="mx-auto mt-3 max-w-md whitespace-pre-line font-display text-xl leading-relaxed text-stone-600">{ev.text?.trim() || DEFAULT_TEXT}</p>

          {date && (
            <div className="mx-auto mt-10 flex max-w-sm items-center justify-center gap-5 text-stone-700">
              <div className="flex-1 border-y border-stone-300 py-2 text-right text-[11px] font-medium uppercase tracking-[0.25em]">
                {date.toLocaleDateString('ro-RO', { weekday: 'long' })}
              </div>
              <div className="text-center">
                <div className="text-[11px] font-medium uppercase tracking-[0.25em] text-olive-700">{date.toLocaleDateString('ro-RO', { month: 'long' })}</div>
                <div className="font-display text-6xl leading-none text-stone-800">{date.getDate()}</div>
                <div className="text-[11px] font-medium tracking-[0.25em] text-stone-500">{date.getFullYear()}</div>
              </div>
              <div className="flex-1 border-y border-stone-300 py-2 text-left text-[11px] font-medium uppercase tracking-[0.25em]">{ev.time ? `ora ${ev.time}` : 'vă așteptăm'}</div>
            </div>
          )}

          {(ev.venue || ev.address) && (
            <div className="mt-9">
              {ev.venue && <div className="font-display text-3xl text-stone-800">{ev.venue}</div>}
              {ev.address && <div className="mt-1 text-sm text-stone-500">{ev.address}</div>}
              {ev.mapsUrl && (
                <a href={ev.mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-full border border-olive-600 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-olive-700 hover:bg-olive-50">
                  Vezi pe hartă
                </a>
              )}
            </div>
          )}
          {ev.ceremony?.trim() && <p className="mx-auto mt-6 max-w-sm whitespace-pre-line text-sm leading-relaxed text-stone-600">{ev.ceremony}</p>}
          {days != null && days > 0 && (
            <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.3em] text-stone-400">
              {days === 1 ? 'Mâine' : `Peste ${days} zile`}
            </p>
          )}
          <Sprig flip className="mx-auto mt-6 h-9 w-28 text-olive-500" />
        </div>

        {/* confirmarea */}
        <div className="mt-6 rounded-[28px] border border-[#e6dcc8] bg-[#fffdf8] px-6 py-8 sm:px-10">
          {answered ? (
            <div className="text-center">
              <div className="font-display text-3xl text-stone-800">{inv.status === 'yes' ? 'Mulțumim, te așteptăm!' : 'Ne pare rău că nu poți ajunge'}</div>
              {inv.status === 'yes' ? (
                <>
                  <p className="mt-2 text-sm text-stone-500">Am notat prezența pentru:</p>
                  <ul className="mt-3 space-y-1 text-stone-700">
                    {coming.map((p) => (
                      <li key={p.id}>
                        {p.name}
                        {p.is_child && <span className="text-stone-400"> (copil)</span>}
                        {p.menu === 'vegetarian' && <span className="text-stone-400"> · meniu vegetarian</span>}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-stone-500">Am notat răspunsul tău. Dacă se schimbă ceva, ne poți anunța tot de aici.</p>
              )}
              {!data.closed && (
                <button onClick={() => setEditing(true)} className="mt-6 text-sm font-medium text-olive-700 underline underline-offset-4">
                  Modifică răspunsul
                </button>
              )}
            </div>
          ) : data.closed ? (
            <div className="text-center">
              <div className="font-display text-2xl text-stone-800">Confirmările s-au încheiat</div>
              <p className="mt-2 text-sm text-stone-500">Dacă vrei să ne anunți ceva, scrie-ne direct.</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="text-center">
                <div className="font-display text-3xl text-stone-800">Confirmă prezența</div>
                {deadline && <p className="mt-1 text-sm text-stone-500">Te rugăm să ne răspunzi până pe {deadline}.</p>}
              </div>

              <div className="mt-6 flex gap-3">
                <Choice active={attending === true} onClick={() => setAttending(true)}>
                  Vin cu drag
                </Choice>
                <Choice tone="stone" active={attending === false} onClick={() => setAttending(false)}>
                  Nu pot ajunge
                </Choice>
              </div>

              {attending && (
                <div className="mt-7 space-y-7">
                  {/* persoanele trecute pe invitatie */}
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">{base.length > 1 ? 'Cine vine' : 'Meniul tău'}</div>
                    <div className="space-y-2">
                      {base.map((p) => {
                        const st = persons[p.id] || { attending: true, menu: 'standard' };
                        const upd = (patch) => setPersons((m) => ({ ...m, [p.id]: { ...st, ...patch } }));
                        return (
                          <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5">
                            {base.length > 1 && <input type="checkbox" className="h-4 w-4 accent-olive-600" checked={st.attending} onChange={(e) => upd({ attending: e.target.checked })} />}
                            <span className={`flex-1 text-[15px] ${st.attending ? 'text-stone-800' : 'text-stone-400 line-through'}`}>{p.name}</span>
                            {!p.is_child && st.attending && (
                              <select className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm" value={st.menu} onChange={(e) => upd({ menu: e.target.value })}>
                                <option value="standard">Meniu standard</option>
                                <option value="vegetarian">Meniu vegetarian</option>
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {inv.allow_plus_one && (
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">Vii însoțit?</div>
                      <div className="flex gap-3">
                        <Choice active={!withPlus} onClick={() => setWithPlus(false)}>
                          Vin singur(ă)
                        </Choice>
                        <Choice active={withPlus} onClick={() => setWithPlus(true)}>
                          Vin cu cineva (+1)
                        </Choice>
                      </div>
                      {withPlus && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <input className={`${inputCls} min-w-0 flex-1`} placeholder="Numele însoțitorului" value={plusName} onChange={(e) => setPlusName(e.target.value)} />
                          <select className="rounded-xl border border-stone-300 bg-white px-2 text-sm" value={plusMenu} onChange={(e) => setPlusMenu(e.target.value)}>
                            <option value="standard">Meniu standard</option>
                            <option value="vegetarian">Meniu vegetarian</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {inv.max_children > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">Veniți cu copii?</div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: inv.max_children + 1 }).map((_, n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setKids((k) => Array.from({ length: n }).map((__, i) => k[i] || ''))}
                            className={`h-11 min-w-11 rounded-full border px-4 text-sm font-medium ${
                              kids.length === n ? 'border-olive-600 bg-olive-600 text-white' : 'border-stone-300 bg-white text-stone-700'
                            }`}
                          >
                            {n === 0 ? 'Fără copii' : n}
                          </button>
                        ))}
                      </div>
                      {kids.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {kids.map((name, i) => (
                            <input key={i} className={inputCls} placeholder={`Numele copilului ${kids.length > 1 ? i + 1 : ''}`} value={name} onChange={(e) => setKids((k) => k.map((x, j) => (j === i ? e.target.value : x)))} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {attending != null && (
                <div className="mt-7">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">{attending ? 'Alergii sau un mesaj pentru noi' : 'Un mesaj pentru noi (opțional)'}</div>
                  <textarea className={inputCls} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>
              )}

              {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={busy || attending == null}
                className="mt-7 w-full rounded-full bg-clay-500 py-3.5 text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-clay-600 disabled:bg-stone-300"
              >
                {busy ? 'Se trimite...' : 'Trimite răspunsul'}
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-stone-400">Cu drag, {names.join(' și ') || 'mirii'}</p>
      </div>
    </div>
  );
}
