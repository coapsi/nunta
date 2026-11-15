# Nunta

Aplicația de organizare a nunții: invitați, invitații personalizate cu confirmare, plan de mese, buget și prag de rentabilitate.

## Cum e construită

- `src/` aplicația (React + Vite + Tailwind)
- `api/rpc.js` un singur endpoint, `POST /api/rpc`, cu `{ "action": "...", ... }`
- `db/schema.sql` schema bazei de date (Postgres pe Neon)
- Găzduire pe Vercel. Variabile de mediu: `DATABASE_URL`, `SESSION_SECRET`

## Legarea unui landing page propriu

Invitația fiecărui invitat are un cod (`token`), vizibil în linkul `/i/<token>`.
Două acțiuni sunt publice și pot fi apelate de pe orice site:

```js
// datele invitației: nume, persoane, ce are voie să aleagă, detaliile nunții
fetch('https://<domeniu>/api/rpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'invite.get', token }),
});

// trimiterea răspunsului
body: JSON.stringify({
  action: 'invite.rsvp',
  token,
  answer: {
    attending: true,
    people: [{ id: '<id persoană>', attending: true, menu: 'standard' }],
    plusOne: { name: 'Nume însoțitor', menu: 'vegetarian' }, // sau null
    children: [{ name: 'Nume copil' }],
    message: 'alergii, mesaj',
  },
});
```

## Local

```
PG_LOCAL=1 DATABASE_URL=postgres://... SESSION_SECRET=... node scripts/dev-api.js
npm run dev
```
