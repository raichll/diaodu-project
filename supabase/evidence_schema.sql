create table if not exists public.dispatch_evidence (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references public.dispatch_records(id) on delete cascade,
  source_system text not null,
  media_type text not null check (media_type in ('image', 'video', 'file', 'map')),
  url text not null,
  label text default '',
  captured_at timestamptz,
  review_status text default '待人工审核',
  used_for_dispatch boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists dispatch_evidence_record_id_idx
  on public.dispatch_evidence (record_id);

create index if not exists dispatch_evidence_source_system_idx
  on public.dispatch_evidence (source_system);

create index if not exists dispatch_evidence_media_type_idx
  on public.dispatch_evidence (media_type);

alter table public.dispatch_evidence enable row level security;

drop policy if exists "public can insert dispatch evidence" on public.dispatch_evidence;
create policy "public can insert dispatch evidence"
on public.dispatch_evidence
for insert
to anon
with check (true);

drop policy if exists "public can read dispatch evidence" on public.dispatch_evidence;
create policy "public can read dispatch evidence"
on public.dispatch_evidence
for select
to anon
using (true);
