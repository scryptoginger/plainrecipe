-- Recipes: canonical_url UNIQUE is the dedup key
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  canonical_url text unique not null,
  source_url    text not null,
  title         text not null,
  summary       text,
  ingredients   jsonb not null default '[]'::jsonb,
  instructions  jsonb not null default '[]'::jsonb,
  image_url     text,
  total_time    text,
  recipe_yield  text,
  author        text,
  created_at    timestamptz not null default now(),
  created_by_ip text
);
create index if not exists recipes_created_at_idx on recipes (created_at desc);

-- Per-IP per-day add counter
create table if not exists rate_limits (
  ip    text not null,
  day   date not null,
  count int  not null default 0,
  primary key (ip, day)
);

-- Atomic increment + limit check in one round trip
create or replace function increment_rate_limit(client_ip text, max_per_day int)
returns table(allowed boolean, current_count int)
language plpgsql as $$
declare c int;
begin
  insert into rate_limits (ip, day, count)
  values (client_ip, current_date, 1)
  on conflict (ip, day) do update set count = rate_limits.count + 1
  returning rate_limits.count into c;
  return query select (c <= max_per_day), c;
end;
$$;

-- Defense in depth: service-role access bypasses RLS; anon access stays blocked.
alter table recipes     enable row level security;
alter table rate_limits enable row level security;
