const MESSAGES = {
  unauthorized: 'Sesiunea a expirat. Autentifică-te din nou.',
  bad_login: 'Email sau parolă greșită.',
  bad_code: 'Linkul de activare nu mai este valabil.',
  bad_email: 'Adresa de email nu pare corectă.',
  weak_password: 'Parola trebuie să aibă cel puțin 8 caractere.',
  email_taken: 'Există deja un cont cu acest email.',
  not_found: 'Nu am găsit ce căutai.',
  closed: 'Perioada de confirmare s-a încheiat. Te rugăm să ne contactezi direct.',
  cannot_delete_self: 'Nu îți poți șterge propriul cont.',
  server: 'A apărut o eroare. Încearcă din nou.',
};

export class RpcError extends Error {
  constructor(code, status) {
    super(MESSAGES[code] || MESSAGES.server);
    this.code = code;
    this.status = status;
  }
}

export async function rpc(action, payload = {}) {
  let res;
  try {
    res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new RpcError('server', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new RpcError(data.error || 'server', res.status);
  return data;
}

export const uid = () => crypto.randomUUID();
