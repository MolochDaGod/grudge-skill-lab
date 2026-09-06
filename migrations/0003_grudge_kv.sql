-- Shared lab cache / world config. Unowned rows (auth off).
-- catalog:weaponSkills  — last-good ObjectStore flatten
-- Never store personal actor sheets here.
create table if not exists grudge_kv (
  key        text primary key,
  payload    text not null,
  updated_at timestamptz not null default now()
);
