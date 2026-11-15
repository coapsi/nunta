import React, { useState } from 'react';
import { rpc } from '../lib/api.js';
import { Button, Field, Input } from '../components/ui.jsx';

export function AuthFrame({ title, subtitle, children }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl">💍</div>
          <h1 className="mt-2 font-display text-3xl font-semibold text-stone-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { member } = await rpc('auth.login', { email, password });
      onLogin(member);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Nunta noastră" subtitle="Intră în cont ca să vezi organizarea.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Parolă">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Se verifică...' : 'Intră în cont'}
        </Button>
      </form>
    </AuthFrame>
  );
}
