import { q } from './_lib/db.js';
import {
  hashPassword,
  verifyPassword,
  sessionCookie,
  clearCookie,
  readSession,
  newCode,
} from './_lib/auth.js';

// Coloanele care pot fi scrise din aplicatie, pe fiecare tabel.
const TABLES = {
  invitations: ['name', 'side', 'grp', 'phone', 'allow_plus_one', 'max_children', 'status', 'message', 'notes', 'gift_amount', 'sent_at', 'responded_at'],
  guests: ['invitation_id', 'name', 'kind', 'is_child', 'menu', 'attending', 'table_id', 'seat', 'sort', 'room_id'],
  tables: ['name', 'shape', 'seats', 'x', 'y', 'rotation', 'config', 'sort'],
  expenses: ['category', 'name', 'kind', 'amount', 'paid', 'vendor', 'due_date', 'notes', 'sort', 'vendor_id', 'status'],
  vendors: ['category', 'name', 'status', 'contact', 'phone', 'email', 'link', 'contract_url', 'notes', 'sort'],
  payments: ['expense_id', 'label', 'amount', 'due_date', 'paid', 'sort'],
  tasks: ['title', 'months_before', 'due_date', 'assignee', 'done', 'notes', 'sort'],
  schedule: ['time', 'title', 'who', 'notes', 'sort'],
  items: ['list', 'grp', 'title', 'note', 'link', 'price', 'done', 'sort'],
  rooms: ['name', 'capacity', 'price', 'notes', 'sort'],
};
const NUMERIC = ['x', 'y', 'rotation', 'gift_amount', 'amount', 'price', 'months_before'];
const NUMERIC_BY_TABLE = { expenses: ['paid'] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ApiError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function clean(row, table) {
  if (!row) return row;
  const out = { ...row };
  for (const k of [...NUMERIC, ...(NUMERIC_BY_TABLE[table] || [])]) if (out[k] != null) out[k] = Number(out[k]);
  return out;
}

async function saveRow(table, row) {
  const cols = TABLES[table];
  if (!cols) throw new ApiError('bad_table');
  if (!row || !UUID.test(row.id || '')) throw new ApiError('bad_id');
  const keys = cols.filter((c) => row[c] !== undefined);
  const values = keys.map((k) => (k === 'config' ? JSON.stringify(row[k] ?? {}) : row[k]));
  // Intai incercam actualizarea (randurile partiale sunt permise), apoi inserarea.
  if (keys.length) {
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const updated = await q(`update ${table} set ${sets} where id = $1 returning *`, [row.id, ...values]);
    if (updated.length) return clean(updated[0], table);
  }
  const names = ['id', ...keys];
  const marks = names.map((_, i) => `$${i + 1}`);
  const rows = await q(
    `insert into ${table} (${names.join(', ')}) values (${marks.join(', ')})
     on conflict (id) do nothing returning *`,
    [row.id, ...values],
  );
  return clean(rows[0] || { id: row.id }, table);
}

async function deleteRow(table, id) {
  if (!TABLES[table]) throw new ApiError('bad_table');
  if (!UUID.test(id || '')) throw new ApiError('bad_id');
  await q(`delete from ${table} where id = $1`, [id]);
}

function publicMember(m) {
  return {
    id: m.id,
    name: m.name,
    role_label: m.role_label,
    email: m.email,
    can_edit: m.can_edit !== false,
    active: !!m.password_hash,
    invite_code: m.password_hash ? null : m.invite_code,
    last_login: m.last_login,
  };
}

const STATE_TABLES = ['invitations', 'guests', 'tables', 'expenses', 'vendors', 'payments', 'tasks', 'schedule', 'items', 'rooms'];

async function loadState() {
  const [settings, members, ...lists] = await Promise.all([
    q('select data from settings where id = 1'),
    q('select * from members order by created_at'),
    ...STATE_TABLES.map((t) => q(`select * from ${t} order by ${t === 'invitations' ? '' : 'sort, '}created_at`)),
  ]);
  const out = { settings: settings[0]?.data || {}, members: members.map(publicMember) };
  STATE_TABLES.forEach((t, i) => (out[t] = lists[i].map((r) => clean(r, t))));
  return out;
}

async function eventInfo() {
  const rows = await q('select data from settings where id = 1');
  return rows[0]?.data?.event || {};
}

function deadlinePassed(event) {
  if (!event.rsvpDeadline) return false;
  const end = new Date(event.rsvpDeadline + 'T23:59:59');
  return !isNaN(end) && Date.now() > end.getTime() + 24 * 3600 * 1000;
}

// ---------- actiuni publice (invitatie + autentificare) ----------
const PUBLIC = {
  async 'invite.get'({ token }) {
    if (!token || typeof token !== 'string') throw new ApiError('not_found', 404);
    const inv = (await q('select * from invitations where token = $1', [token]))[0];
    if (!inv) throw new ApiError('not_found', 404);
    const people = await q(
      'select id, name, kind, is_child, attending, menu from guests where invitation_id = $1 order by sort, created_at',
      [inv.id],
    );
    const event = await eventInfo();
    return {
      invitation: {
        name: inv.name,
        status: inv.status,
        allow_plus_one: inv.allow_plus_one,
        max_children: inv.max_children,
        message: inv.message,
      },
      people,
      event,
      closed: deadlinePassed(event),
    };
  },

  async 'invite.rsvp'({ token, answer }) {
    if (!token || typeof token !== 'string' || !answer) throw new ApiError('bad_request');
    if (deadlinePassed(await eventInfo())) throw new ApiError('closed');
    const rows = await q('select rsvp_submit($1, $2::jsonb) as r', [token, JSON.stringify(answer)]);
    const r = rows[0]?.r || {};
    if (r.error) throw new ApiError(r.error, 404);
    return PUBLIC['invite.get']({ token });
  },

  async 'auth.me'(_, { req }) {
    const id = readSession(req);
    if (!id) return { member: null };
    const m = (await q('select * from members where id = $1', [id]))[0];
    return { member: m && m.password_hash ? publicMember(m) : null };
  },

  async 'auth.login'({ email, password }, { res }) {
    const m = (await q('select * from members where lower(email) = lower($1)', [String(email || '').trim()]))[0];
    if (!m || !verifyPassword(String(password || ''), m.password_hash)) {
      await new Promise((r) => setTimeout(r, 600));
      throw new ApiError('bad_login', 401);
    }
    await q('update members set last_login = now() where id = $1', [m.id]);
    res.setHeader('Set-Cookie', sessionCookie(m.id));
    return { member: publicMember(m) };
  },

  async 'auth.logout'(_, { res }) {
    res.setHeader('Set-Cookie', clearCookie());
    return { ok: true };
  },

  async 'auth.activateInfo'({ code }) {
    const m = (await q('select * from members where invite_code = $1', [String(code || '')]))[0];
    if (!m) throw new ApiError('bad_code', 404);
    return { name: m.name, email: m.email, role_label: m.role_label };
  },

  async 'auth.activate'({ code, email, password, name }, { res }) {
    const m = (await q('select * from members where invite_code = $1', [String(code || '')]))[0];
    if (!m) throw new ApiError('bad_code', 404);
    const mail = String(email || m.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(mail)) throw new ApiError('bad_email');
    if (String(password || '').length < 8) throw new ApiError('weak_password');
    const taken = await q('select 1 from members where lower(email) = $1 and id <> $2', [mail, m.id]);
    if (taken.length) throw new ApiError('email_taken');
    await q(
      `update members set email = $1, password_hash = $2, invite_code = null,
         name = coalesce(nullif($3, ''), name), last_login = now() where id = $4`,
      [mail, hashPassword(password), String(name || '').trim(), m.id],
    );
    res.setHeader('Set-Cookie', sessionCookie(m.id));
    return { ok: true };
  },
};

// ---------- actiuni pentru conturile nuntii ----------
const READ_ONLY_ACTIONS = new Set(['state.load']);

const PRIVATE = {
  'state.load': () => loadState(),

  // ops: [{ op: 'save', table, row } | { op: 'delete', table, id }]
  async batch({ ops }) {
    if (!Array.isArray(ops) || ops.length > 500) throw new ApiError('bad_request');
    const saved = [];
    for (const o of ops) {
      if (o.op === 'save') saved.push({ table: o.table, row: await saveRow(o.table, o.row) });
      else if (o.op === 'delete') await deleteRow(o.table, o.id);
      else throw new ApiError('bad_op');
    }
    return { saved };
  },

  async 'settings.save'({ data }) {
    if (!data || typeof data !== 'object') throw new ApiError('bad_request');
    await q('update settings set data = $1::jsonb where id = 1', [JSON.stringify(data)]);
    return { settings: data };
  },

  async 'member.create'({ name, role_label, email, can_edit }) {
    const mail = String(email || '').trim().toLowerCase() || null;
    if (mail) {
      const taken = await q('select 1 from members where lower(email) = $1', [mail]);
      if (taken.length) throw new ApiError('email_taken');
    }
    const rows = await q(
      'insert into members (name, role_label, email, invite_code, can_edit) values ($1, $2, $3, $4, $5) returning *',
      [String(name || '').trim(), String(role_label || '').trim(), mail, newCode(), can_edit !== false],
    );
    return { member: publicMember(rows[0]) };
  },

  async 'member.reset'({ id }) {
    const rows = await q(
      'update members set password_hash = null, invite_code = $2 where id = $1 returning *',
      [id, newCode()],
    );
    if (!rows.length) throw new ApiError('not_found', 404);
    return { member: publicMember(rows[0]) };
  },

  async 'member.setAccess'({ id, can_edit }, { memberId }) {
    if (id === memberId) throw new ApiError('cannot_change_self');
    const rows = await q('update members set can_edit = $2 where id = $1 returning *', [id, !!can_edit]);
    if (!rows.length) throw new ApiError('not_found', 404);
    return { member: publicMember(rows[0]) };
  },

  async 'member.delete'({ id }, { memberId }) {
    if (id === memberId) throw new ApiError('cannot_delete_self');
    await q('delete from members where id = $1', [id]);
    return { ok: true };
  },
};

export default async function handler(req, res) {
  // Actiunile publice pot fi apelate si de pe alt site (landing page-ul invitatiei).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { action, ...payload } = body;
    const ctx = { req, res };

    if (PUBLIC[action]) return res.status(200).json(await PUBLIC[action](payload, ctx));

    if (PRIVATE[action]) {
      const memberId = readSession(req);
      const me = memberId && (await q('select can_edit from members where id = $1 and password_hash is not null', [memberId]))[0];
      if (!me) throw new ApiError('unauthorized', 401);
      // Conturile fara drept de editare pot doar citi.
      if (!READ_ONLY_ACTIONS.has(action) && me.can_edit === false) throw new ApiError('read_only', 403);
      return res.status(200).json(await PRIVATE[action](payload, { ...ctx, memberId }));
    }
    throw new ApiError('unknown_action', 404);
  } catch (e) {
    if (e instanceof ApiError) return res.status(e.status).json({ error: e.code });
    console.error('rpc error', e);
    return res.status(500).json({ error: 'server' });
  }
}
