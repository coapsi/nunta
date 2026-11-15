-- Schema aplicatiei de nunta. Se poate rula de mai multe ori.

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);
insert into settings (id) values (1) on conflict do nothing;

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  role_label text not null default '',
  email text unique,
  password_hash text,
  invite_code text unique,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Masa',
  shape text not null default 'round',
  seats int not null default 10,
  x numeric not null default 200,
  y numeric not null default 200,
  rotation numeric not null default 0,
  config jsonb not null default '{}'::jsonb,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  name text not null default '',
  side text not null default 'comun',
  grp text not null default '',
  phone text not null default '',
  allow_plus_one boolean not null default true,
  max_children int not null default 0,
  status text not null default 'pending',
  message text not null default '',
  notes text not null default '',
  gift_amount numeric,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references invitations(id) on delete cascade,
  name text not null default '',
  kind text not null default 'primary',
  is_child boolean not null default false,
  menu text not null default 'standard',
  attending boolean,
  table_id uuid references tables(id) on delete set null,
  seat int,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists guests_invitation_idx on guests(invitation_id);
create index if not exists guests_table_idx on guests(table_id);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Altele',
  name text not null default '',
  kind text not null default 'fixed',
  amount numeric not null default 0,
  paid numeric not null default 0,
  vendor text not null default '',
  due_date text,
  notes text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Raspunsul unui invitat, intr-o singura tranzactie.
-- payload: { attending: bool, people: [{id, attending, menu}], plusOne: {name, menu} | null,
--            children: [{name}], message: text }
create or replace function rsvp_submit(p_token text, p jsonb) returns jsonb
language plpgsql as $$
declare
  inv invitations%rowtype;
  yes boolean := coalesce((p->>'attending')::boolean, false);
  person jsonb;
  po_name text := nullif(trim(coalesce(p->'plusOne'->>'name', '')), '');
  po_menu text := coalesce(nullif(p->'plusOne'->>'menu', ''), 'standard');
  po_id uuid;
  kids jsonb := coalesce(p->'children', '[]'::jsonb);
  kid_ids uuid[];
  n int;
  i int;
  kname text;
begin
  select * into inv from invitations where token = p_token for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  update invitations
     set status = case when yes then 'yes' else 'no' end,
         message = left(coalesce(p->>'message', ''), 2000),
         responded_at = now()
   where id = inv.id;

  if not yes then
    delete from guests where invitation_id = inv.id and kind in ('plus_one', 'child_rsvp');
    update guests set attending = false, table_id = null, seat = null where invitation_id = inv.id;
    return jsonb_build_object('ok', true);
  end if;

  -- persoanele trecute de miri pe invitatie
  update guests set attending = true where invitation_id = inv.id and kind not in ('plus_one', 'child_rsvp');
  for person in select * from jsonb_array_elements(coalesce(p->'people', '[]'::jsonb)) loop
    update guests
       set attending = coalesce((person->>'attending')::boolean, true),
           menu = coalesce(nullif(person->>'menu', ''), menu)
     where id = (person->>'id')::uuid and invitation_id = inv.id and kind not in ('plus_one', 'child_rsvp');
  end loop;
  update guests set table_id = null, seat = null where invitation_id = inv.id and attending = false;

  -- insotitor
  select id into po_id from guests where invitation_id = inv.id and kind = 'plus_one' limit 1;
  if inv.allow_plus_one and po_name is not null then
    if po_id is null then
      insert into guests (invitation_id, name, kind, attending, menu, sort)
      values (inv.id, left(po_name, 120), 'plus_one', true, po_menu, 50);
    else
      update guests set name = left(po_name, 120), attending = true, menu = po_menu where id = po_id;
    end if;
  else
    delete from guests where invitation_id = inv.id and kind = 'plus_one';
  end if;

  -- copii adaugati de invitat
  n := least(jsonb_array_length(kids), greatest(inv.max_children, 0));
  select coalesce(array_agg(id order by sort, created_at), '{}') into kid_ids
    from guests where invitation_id = inv.id and kind = 'child_rsvp';
  for i in 1..n loop
    kname := coalesce(nullif(trim(kids->(i-1)->>'name'), ''), 'Copil ' || i);
    if i <= coalesce(array_length(kid_ids, 1), 0) then
      update guests set name = left(kname, 120), attending = true where id = kid_ids[i];
    else
      insert into guests (invitation_id, name, kind, is_child, menu, attending, sort)
      values (inv.id, left(kname, 120), 'child_rsvp', true, 'copil', true, 60 + i);
    end if;
  end loop;
  if coalesce(array_length(kid_ids, 1), 0) > n then
    delete from guests where id = any(kid_ids[n+1:]);
  end if;

  return jsonb_build_object('ok', true);
end $$;

-- ---------- v2: furnizori, plati, checklist, programul zilei, liste, cazare ----------
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Altele',
  name text not null default '',
  status text not null default 'cautam',
  contact text not null default '',
  phone text not null default '',
  email text not null default '',
  link text not null default '',
  contract_url text not null default '',
  notes text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table expenses add column if not exists vendor_id uuid references vendors(id) on delete set null;
alter table expenses add column if not exists status text not null default 'estimat';

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  label text not null default '',
  amount numeric not null default 0,
  due_date text,
  paid boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  months_before numeric not null default 6,
  due_date text,
  assignee text not null default '',
  done boolean not null default false,
  notes text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists schedule (
  id uuid primary key default gen_random_uuid(),
  time text not null default '',
  title text not null default '',
  who text not null default '',
  notes text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  list text not null,
  grp text not null default '',
  title text not null default '',
  note text not null default '',
  link text not null default '',
  price numeric,
  done boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists items_list_idx on items(list);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  capacity int not null default 2,
  price numeric not null default 0,
  notes text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table guests add column if not exists room_id uuid references rooms(id) on delete set null;
