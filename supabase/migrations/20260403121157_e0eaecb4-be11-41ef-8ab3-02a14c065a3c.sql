ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS read_until timestamptz DEFAULT NULL;