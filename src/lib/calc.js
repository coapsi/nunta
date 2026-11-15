// Toate calculele de numar de persoane si buget stau aici, ca sa poata fi verificate separat.

export const DEFAULT_EVENT = {
  groom: '',
  bride: '',
  date: '',
  time: '',
  venue: '',
  address: '',
  mapsUrl: '',
  ceremony: '',
  rsvpDeadline: '',
  text: '',
  currency: 'EUR',
};

export const DEFAULT_CALC = {
  mode: 'estimate', // confirmed | estimate | all | custom
  rate: 85,
  customAdults: 100,
  customChildren: 10,
  giftPerAdult: 150,
  targetProfit: 0,
};

export const EXPENSE_KINDS = {
  fixed: 'Fix',
  per_adult: 'Per adult',
  per_child: 'Per copil',
  per_person: 'Per persoană',
  per_table: 'Per masă',
};

export const eventOf = (settings) => ({ ...DEFAULT_EVENT, ...(settings?.event || {}) });
export const calcOf = (settings) => ({ ...DEFAULT_CALC, ...(settings?.calc || {}) });

export function money(value, currency = 'EUR', digits = 0) {
  if (value == null || !isFinite(value)) return '-';
  return (
    new Intl.NumberFormat('ro-RO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value) +
    ' ' +
    currency
  );
}

// Cate persoane avem in fiecare stare.
export function headcount(invitations, guests) {
  const byInv = new Map();
  for (const g of guests) {
    if (!byInv.has(g.invitation_id)) byInv.set(g.invitation_id, []);
    byInv.get(g.invitation_id).push(g);
  }
  const c = {
    invitations: invitations.length,
    invYes: 0,
    invNo: 0,
    invPending: 0,
    confirmedAdults: 0,
    confirmedChildren: 0,
    declined: 0,
    pendingAdults: 0, // persoane trecute pe invitatii fara raspuns
    pendingChildren: 0,
    pendingPlusOnes: 0, // insotitori posibili pe invitatii fara raspuns
    seated: 0,
  };
  for (const inv of invitations) {
    const people = byInv.get(inv.id) || [];
    if (inv.status === 'yes') c.invYes += 1;
    else if (inv.status === 'no') c.invNo += 1;
    else c.invPending += 1;
    for (const g of people) {
      if (g.table_id) c.seated += 1;
      if (inv.status === 'no' || g.attending === false) c.declined += 1;
      else if (inv.status === 'yes' && g.attending === true) g.is_child ? (c.confirmedChildren += 1) : (c.confirmedAdults += 1);
      else g.is_child ? (c.pendingChildren += 1) : (c.pendingAdults += 1);
    }
    if (inv.status === 'pending' && inv.allow_plus_one && !people.some((g) => g.kind === 'plus_one')) c.pendingPlusOnes += 1;
  }
  c.confirmed = c.confirmedAdults + c.confirmedChildren;
  c.pending = c.pendingAdults + c.pendingChildren;
  c.totalListed = c.confirmed + c.pending + c.declined;
  return c;
}

// Numarul de adulti si copii pentru scenariul ales in buget.
export function scenario(calc, counts, tableCount) {
  let adults;
  let children;
  let payingInvitations;
  const rate = Math.min(100, Math.max(0, Number(calc.rate) || 0)) / 100;
  if (calc.mode === 'confirmed') {
    adults = counts.confirmedAdults;
    children = counts.confirmedChildren;
    payingInvitations = counts.invYes;
  } else if (calc.mode === 'all') {
    adults = counts.confirmedAdults + counts.pendingAdults + counts.pendingPlusOnes;
    children = counts.confirmedChildren + counts.pendingChildren;
    payingInvitations = counts.invYes + counts.invPending;
  } else if (calc.mode === 'custom') {
    adults = Math.max(0, Number(calc.customAdults) || 0);
    children = Math.max(0, Number(calc.customChildren) || 0);
    payingInvitations = null;
  } else {
    adults = Math.round(counts.confirmedAdults + (counts.pendingAdults + counts.pendingPlusOnes) * rate);
    children = Math.round(counts.confirmedChildren + counts.pendingChildren * rate);
    payingInvitations = Math.round(counts.invYes + counts.invPending * rate);
  }
  const persons = adults + children;
  const tables = Math.max(tableCount, Math.ceil(persons / 10));
  return { adults, children, persons, tables, payingInvitations };
}

export function expenseTotal(e, s) {
  const amount = Number(e.amount) || 0;
  switch (e.kind) {
    case 'per_adult':
      return amount * s.adults;
    case 'per_child':
      return amount * s.children;
    case 'per_person':
      return amount * s.persons;
    case 'per_table':
      return amount * s.tables;
    default:
      return amount;
  }
}

export function budget(expenses, s, calc) {
  let total = 0;
  let fixed = 0;
  let paid = 0;
  let perAdult = 0; // cat costa un adult in plus
  let perChild = 0;
  for (const e of expenses) {
    const t = expenseTotal(e, s);
    total += t;
    paid += Number(e.paid) || 0;
    const a = Number(e.amount) || 0;
    if (e.kind === 'fixed' || e.kind === 'per_table') fixed += t;
    if (e.kind === 'per_adult' || e.kind === 'per_person') perAdult += a;
    if (e.kind === 'per_child' || e.kind === 'per_person') perChild += a;
  }
  const gift = Number(calc.giftPerAdult) || 0;
  const target = Number(calc.targetProfit) || 0;
  const income = gift * s.adults;
  return {
    total,
    fixed,
    variable: total - fixed,
    paid,
    remaining: total - paid,
    perAdult,
    perChild,
    breakEvenPerAdult: s.adults > 0 ? total / s.adults : null,
    breakEvenPerInvitation: s.payingInvitations > 0 ? total / s.payingInvitations : null,
    neededPerAdult: s.adults > 0 ? (total + target) / s.adults : null,
    income,
    profit: income - total,
    // adulti necesari ca sa iesi pe zero la darul mediu ales (costurile variabile cresc cu fiecare adult)
    breakEvenAdults: gift - perAdult > 0 ? Math.ceil((fixed + perChild * s.children) / (gift - perAdult)) : null,
  };
}

// Daca o cheltuiala are transe de plata, "platit" vine din transele bifate.
export function withPayments(expenses, payments) {
  const by = new Map();
  for (const p of payments) {
    if (!by.has(p.expense_id)) by.set(p.expense_id, []);
    by.get(p.expense_id).push(p);
  }
  return expenses.map((e) => {
    const list = by.get(e.id);
    if (!list?.length) return e;
    return { ...e, paid: list.filter((p) => p.paid).reduce((s, p) => s + (Number(p.amount) || 0), 0), hasPayments: true };
  });
}

export const EXPENSE_STATUS = { estimat: 'Estimat', oferta: 'Ofertă primită', contractat: 'Contractat', platit: 'Plătit integral' };

export const VENDOR_STATUS = { cautam: 'Căutăm', oferta: 'Ofertă primită', rezervat: 'Rezervat', contract: 'Contract semnat', gata: 'Încheiat' };

// Fazele checklistului, dupa cate luni mai sunt pana la nunta.
export const PHASES = [
  { key: 12, label: 'Cu 10-12 luni înainte' },
  { key: 9, label: 'Cu 7-9 luni înainte' },
  { key: 6, label: 'Cu 4-6 luni înainte' },
  { key: 3, label: 'Cu 2-3 luni înainte' },
  { key: 1, label: 'Ultima lună' },
  { key: 0.25, label: 'Ultima săptămână' },
  { key: 0, label: 'Ziua dinainte și ziua nunții' },
  { key: -1, label: 'După nuntă' },
];

// Termenul unei sarcini: data pusa de mana sau calculata din data nuntii.
export function taskDue(task, weddingDate) {
  if (task.due_date) return task.due_date;
  if (!weddingDate) return null;
  const d = new Date(weddingDate + 'T00:00:00');
  const m = Number(task.months_before) || 0;
  if (m === 0.25) d.setDate(d.getDate() - 7);
  else if (m === 0) d.setDate(d.getDate() - 1);
  else if (m < 0) d.setDate(d.getDate() + 30);
  else d.setMonth(d.getMonth() - ({ 12: 10, 9: 7, 6: 4, 3: 2 }[m] || m)); // capatul de jos al intervalului
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function todayIso() {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
}
