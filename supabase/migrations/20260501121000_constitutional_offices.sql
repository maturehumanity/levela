-- Constitutional offices tables and RPCs
CREATE TABLE IF NOT EXISTS public.constitutional_offices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), office_key text NOT NULL UNIQUE);
