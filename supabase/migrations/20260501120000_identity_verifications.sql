-- Identity verification tables and RPCs
CREATE TABLE IF NOT EXISTS public.identity_verification_providers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_key text NOT NULL UNIQUE);
