-- ============================================================
-- KEUANGAN HARIAN - Setup Database Online + Login Multi-Akun
-- Jalankan di: Supabase Dashboard > SQL Editor > New query > Run
--
-- Catatan: script ini menghapus tabel 'transactions' lama bila ada
-- (data cloud lama hilang; data di HP/web lokal tetap aman).
-- Setiap akun login HANYA dapat melihat data miliknya sendiri (RLS).
-- ============================================================

drop table if exists public.transactions cascade;

create table public.transactions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  jenis text not null check (jenis in ('masuk','keluar')),
  jumlah numeric not null,
  ket text default '',
  tanggal date not null,
  jam text default '',
  deleted boolean not null default false,
  device text default '',
  updated_at timestamptz not null default now()
);

create index idx_transactions_user on public.transactions(user_id);

alter table public.transactions enable row level security;

create policy "baca data sendiri"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "tambah data sendiri"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "update data sendiri"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "hapus data sendiri"
  on public.transactions for delete
  using (auth.uid() = user_id);
