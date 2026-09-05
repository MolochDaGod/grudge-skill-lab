-- Warlords skill visual overrides. Unowned catalog rows (auth off).
create table if not exists grudge_skills (
  id         text primary key,
  payload    text not null,
  updated_at timestamptz not null default now()
);
create index if not exists grudge_skills_updated_idx on grudge_skills (updated_at desc);
