import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { rpc } from '../lib/api.js';
import { Button, Field, Input } from '../components/ui.jsx';
import { AuthFrame } from './Login.jsx';

export default function Activate() {
  const { code } = useParams();
  const [info, setInfo] = useState(undefined);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    rpc('auth.activateInfo', { code })
      .then((r) => {
        setInfo(r);
        setName(r.name || '');
        setEmail(r.email || '');
      })
      .catch(() => setInfo(null));
  }, [code]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await rpc('auth.activate', { code, name, email, password });
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (info === undefined) return <div className="py-24 text-center text-sm text-stone-500">Se încarcă...</div>;
  if (info === null)
    return (
      <AuthFrame title="Link expirat">
        <p className="text-sm text-stone-600">
          Linkul de activare nu mai este valabil. Dacă ți-ai făcut deja contul, <a className="font-medium text-olive-700 underline" href="/">intră în cont</a>. Altfel, cere un link nou.
        </p>
      </AuthFrame>
    );

  return (
    <AuthFrame title="Bine ai venit" subtitle="Alege-ți emailul și parola pentru aplicația nunții.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Numele tău">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Parolă" hint="Minimum 8 caractere.">
          <Input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Se salvează...' : 'Creează contul'}
        </Button>
      </form>
    </AuthFrame>
  );
}
