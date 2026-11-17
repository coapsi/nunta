import React, { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { rpc } from '../lib/api.js';
import { eventOf } from '../lib/calc.js';
import { Badge, Button, Card, Editable, Field, Input, PageHeader, Select, Textarea } from '../components/ui.jsx';

export default function Settings({ member }) {
  const { settings, saveSettings, members, setMembers, notify, canEdit } = useStore();
  const ev = eventOf(settings);
  const set = (k, v) => saveSettings({ ...settings, event: { ...ev, [k]: v } });
  const [draft, setDraft] = useState({ name: '', role_label: 'Părinte', can_edit: false });
  const link = (code) => `${window.location.origin}/activare/${code}`;

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Link copiat.');
    } catch {
      window.prompt('Copiază linkul:', text);
    }
  }

  async function addMember() {
    if (!draft.name.trim()) return;
    try {
      const { member: m } = await rpc('member.create', draft);
      setMembers((list) => [...list, m]);
      setDraft({ name: '', role_label: 'Părinte', can_edit: false });
      copy(link(m.invite_code));
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  async function reset(m) {
    if (!window.confirm(`Resetezi accesul pentru ${m.name}? Parola veche nu va mai merge și primești un link nou de activare.`)) return;
    try {
      const { member: updated } = await rpc('member.reset', { id: m.id });
      setMembers((list) => list.map((x) => (x.id === m.id ? updated : x)));
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  async function setAccess(m, value) {
    try {
      const { member: updated } = await rpc('member.setAccess', { id: m.id, can_edit: value });
      setMembers((list) => list.map((x) => (x.id === m.id ? updated : x)));
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  async function remove(m) {
    if (!window.confirm(`Ștergi contul lui ${m.name}?`)) return;
    try {
      await rpc('member.delete', { id: m.id });
      setMembers((list) => list.filter((x) => x.id !== m.id));
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Setări" subtitle={canEdit ? 'Detaliile nunții apar pe invitația fiecărui invitat. Se salvează singure.' : 'Detaliile nunții și cine are acces la aplicație.'} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-stone-800">Detaliile nunții</h3>
          <Editable canEdit={canEdit}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mireasa">
                <Input value={ev.bride} onChange={(e) => set('bride', e.target.value)} />
              </Field>
              <Field label="Mirele">
                <Input value={ev.groom} onChange={(e) => set('groom', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data">
                <Input type="date" value={ev.date} onChange={(e) => set('date', e.target.value)} />
              </Field>
              <Field label="Ora petrecerii">
                <Input type="time" value={ev.time} onChange={(e) => set('time', e.target.value)} />
              </Field>
            </div>
            <Field label="Locația">
              <Input value={ev.venue} onChange={(e) => set('venue', e.target.value)} placeholder="Numele locației" />
            </Field>
            <Field label="Adresa">
              <Input value={ev.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="Link Google Maps">
              <Input value={ev.mapsUrl} onChange={(e) => set('mapsUrl', e.target.value)} placeholder="https://maps.app.goo.gl/..." />
            </Field>
            <Field label="Cununia (opțional)" hint="Ex: Cununia religioasă, ora 16:00, Biserica ...">
              <Textarea rows={2} value={ev.ceremony} onChange={(e) => set('ceremony', e.target.value)} />
            </Field>
            <Field label="Textul invitației" hint="Apare sub nume, pe invitație. Dacă îl lași gol, se folosește un text standard.">
              <Textarea rows={4} value={ev.text} onChange={(e) => set('text', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Confirmări până la" hint="După această dată, invitația nu mai primește răspunsuri.">
                <Input type="date" value={ev.rsvpDeadline} onChange={(e) => set('rsvpDeadline', e.target.value)} />
              </Field>
              <Field label="Moneda bugetului">
                <Select value={ev.currency} onChange={(e) => set('currency', e.target.value)}>
                  <option value="EUR">EUR</option>
                  <option value="RON">RON</option>
                </Select>
              </Field>
            </div>
          </div>
          </Editable>
        </Card>

        <Card className="self-start">
          <h3 className="mb-1 text-sm font-semibold text-stone-800">Cine are acces</h3>
          <p className="mb-3 text-xs text-stone-500">
            Toate conturile văd tot. Doar cele marcate „poate modifica” pot schimba ceva.
            {canEdit && ' Adaugi o persoană, îi trimiți linkul de activare și își alege singură emailul și parola.'}
          </p>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="rounded-xl border border-stone-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-stone-800">{m.name || 'Fără nume'}</span>
                  {m.role_label && <Badge>{m.role_label}</Badge>}
                  <Badge tone={m.active ? 'green' : 'amber'}>{m.active ? 'activ' : 'așteaptă activarea'}</Badge>
                  {m.id === member.id && <Badge tone="clay">tu</Badge>}
                  <Badge tone={m.can_edit ? 'green' : 'stone'}>{m.can_edit ? 'poate modifica' : 'doar vizualizare'}</Badge>
                  <div className="ml-auto flex gap-1">
                    {canEdit && m.id !== member.id && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setAccess(m, !m.can_edit)}>
                          {m.can_edit ? 'Doar vizualizare' : 'Permite modificări'}
                        </Button>
                        {m.active && (
                          <Button size="sm" variant="ghost" onClick={() => reset(m)}>
                            Resetează
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => remove(m)}>
                          Șterge
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {m.email && <div className="mt-0.5 text-xs text-stone-500">{m.email}</div>}
                {canEdit && !m.active && m.invite_code && (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">{link(m.invite_code)}</code>
                    <Button size="sm" variant="secondary" onClick={() => copy(link(m.invite_code))}>
                      Copiază
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {canEdit && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-4">
            <Field label="Nume" className="min-w-0 flex-1">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex: Mama Dariei" />
            </Field>
            <Field label="Rol" className="w-32">
              <Select value={draft.role_label} onChange={(e) => setDraft({ ...draft, role_label: e.target.value, can_edit: ['Mire', 'Mireasă'].includes(e.target.value) })}>
                {['Mire', 'Mireasă', 'Părinte', 'Naș', 'Altul'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Field label="Acces" className="w-40">
              <Select value={draft.can_edit ? 'edit' : 'view'} onChange={(e) => setDraft({ ...draft, can_edit: e.target.value === 'edit' })}>
                <option value="view">Doar vizualizare</option>
                <option value="edit">Poate modifica</option>
              </Select>
            </Field>
            <Button onClick={addMember} disabled={!draft.name.trim()}>
              Adaugă
            </Button>
          </div>
          )}
        </Card>
      </div>
    </div>
  );
}
