-- Adds per-dataset updated timestamps to avoid reloading
-- Run this in Supabase SQL editor (or apply via your migration process).

alter table public.websites
  add column if not exists keywords_updated_at timestamptz,
  add column if not exists competitors_updated_at timestamptz;

create index if not exists websites_keywords_updated_at_idx
  on public.websites (id, keywords_updated_at);

create index if not exists websites_competitors_updated_at_idx
  on public.websites (id, competitors_updated_at);

-- Trigger: bump ONLY the relevant timestamp if that JSON sub-field changed.
create or replace function public.bump_websites_dataset_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- If ONLY keywords array changed => bump keywords_updated_at
  if (new.keywords->'keywords') is distinct from (old.keywords->'keywords') then
    new.keywords_updated_at = now();
  end if;

  -- If ONLY competitors array changed => bump competitors_updated_at
  if (new.keywords->'competitors') is distinct from (old.keywords->'competitors') then
    new.competitors_updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bump_websites_dataset_updated_at on public.websites;

create trigger trg_bump_websites_dataset_updated_at
before update on public.websites
for each row
execute function public.bump_websites_dataset_updated_at();
