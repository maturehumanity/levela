ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT now();

UPDATE public.profiles
SET last_active_at = COALESCE(last_active_at, updated_at, created_at);
