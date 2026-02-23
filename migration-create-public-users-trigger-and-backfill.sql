-- Migration: create trigger to sync auth.users -> public.users and backfill missing rows
-- 1) Create function + trigger to auto-insert into public.users when a new auth.users row is created
-- 2) Backfill any existing auth.users rows that don't yet have a corresponding public.users row

-- Function: insert a public.users row when auth.users is created
CREATE OR REPLACE FUNCTION public.create_public_user_on_auth_insert()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, subscribe, package, created_at)
  VALUES (NEW.id, NEW.email, false, 'free', now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: run after insert on auth.users
DROP TRIGGER IF EXISTS auth_user_insert_to_public_users ON auth.users;
CREATE TRIGGER auth_user_insert_to_public_users
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_public_user_on_auth_insert();

-- Backfill: insert any auth.users that are missing from public.users
INSERT INTO public.users (id, email, subscribe, package, created_at)
SELECT a.id, a.email, false, 'free', now()
FROM auth.users a
LEFT JOIN public.users p ON p.id = a.id
WHERE p.id IS NULL;
