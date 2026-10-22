-- In Supabase: SQL Editor -> New query -> paste -> Run
create table if not exists public.products (
  id         bigint generated always as identity primary key,
  category   text not null,
  item       text not null,
  unit       text not null,
  price      numeric not null check (price >= 0),
  swatch     text not null default '#c23b2c',
  available  boolean not null default true,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 1 and 120),
  phone      text not null check (char_length(phone) between 1 and 40),
  email      text not null default '' check (char_length(email) <= 200),
  type       text not null default 'Product Inquiry',
  message    text not null check (char_length(message) between 1 and 3000),
  status     text not null default 'new' check (status in ('new','progress','resolved')),
  note       text not null default '',
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.products  enable row level security;
alter table public.inquiries enable row level security;

-- Products: everyone sees non-archived ones; only the logged-in admin can see/change everything
create policy "public reads active products" on public.products
  for select to anon, authenticated using (archived = false);
create policy "admin reads all products" on public.products
  for select to authenticated using (true);
create policy "admin inserts products" on public.products
  for insert to authenticated with check (true);
create policy "admin updates products" on public.products
  for update to authenticated using (true) with check (true);
create policy "admin deletes products" on public.products
  for delete to authenticated using (true);

-- Inquiries: anyone can send one (insert only); only the admin can read/change/delete
create policy "anyone sends inquiry" on public.inquiries
  for insert to anon, authenticated with check (status = 'new' and archived = false);
create policy "admin reads inquiries" on public.inquiries
  for select to authenticated using (true);
create policy "admin updates inquiries" on public.inquiries
  for update to authenticated using (true) with check (true);
create policy "admin deletes inquiries" on public.inquiries
  for delete to authenticated using (true);

-- Starting catalog (same as the website's original products)
insert into public.products (category, item, unit, price, swatch) values
 ('Boysen','Gloss Latex','3 Tins',3100,'#c23b2c'),
 ('Boysen','Flat Latex','3 Tins',2700,'#e2a638'),
 ('Boysen','Plexibond','3 Tins',3400,'#2f7566'),
 ('Roofguard Boysen','Spanish Red','2 Tins',2720,'#a13f2b'),
 ('Rain or Shine','Ivory / Tulle White / Milk / Tulips / Coldmist','4 Gals',677,'#efe6d3'),
 ('Domino','Texas QDE White','8 Gals',468,'#f4f1ea'),
 ('Domino','Epoxy Primer White','4 Gals',608,'#e9e4d6'),
 ('Thinner','Paint Thinner','3 Gals',435,'#cbb23a'),
 ('Thinner','Lacquer Thinner','6 Gals',295,'#d6c65a'),
 ('Plastic Varnish','950 ML Maple / Brown / Mahogany','6 Pcs',150,'#7a4a2b'),
 ('Paint Brush','1/2 inch','2 Box',10,'#2f4f7a'),
 ('Roller','#7 Roller','1 Box',80,'#7a3f6b');