create extension if not exists pgcrypto;

create table if not exists public.dispatch_records (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  event_type text not null,
  title text not null,
  description text default '',
  location text default '',
  region text default '',
  severity text default '一般',
  status text default '待处理',
  event_time timestamptz default now(),
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists dispatch_records_created_at_idx
  on public.dispatch_records (created_at desc);

create index if not exists dispatch_records_source_system_idx
  on public.dispatch_records (source_system);

create index if not exists dispatch_records_status_idx
  on public.dispatch_records (status);

alter table public.dispatch_records enable row level security;

drop policy if exists "public can insert dispatch records" on public.dispatch_records;
create policy "public can insert dispatch records"
on public.dispatch_records
for insert
to anon
with check (true);

drop policy if exists "public can read dispatch records" on public.dispatch_records;
create policy "public can read dispatch records"
on public.dispatch_records
for select
to anon
using (true);

insert into public.dispatch_records (
  source_system,
  event_type,
  title,
  description,
  location,
  region,
  severity,
  status,
  payload
)
select
  item.source_system,
  item.event_type,
  item.title,
  item.description,
  item.location,
  item.region,
  item.severity,
  item.status,
  item.payload::jsonb
from (
  values
  (
    '高空视频系统',
    '视频AI告警',
    '疑似烟雾异常告警',
    '高空视频识别到疑似烟雾，已进入复核队列。',
    '高空视频点位 A-013',
    '锦江区',
    '较重',
    '待处理',
    '{"demo": true}'
  ),
  (
    '排口监控系统',
    '排口浓度异常',
    '总磷指标短时波动',
    '排口在线监测出现短时波动，建议核对站点运维状态。',
    '排口 P-207',
    '龙泉驿区',
    '一般',
    '处理中',
    '{"demo": true}'
  )
) as item(source_system, event_type, title, description, location, region, severity, status, payload)
where not exists (
  select 1
  from public.dispatch_records existing
  where existing.payload ->> 'demo' = 'true'
);
