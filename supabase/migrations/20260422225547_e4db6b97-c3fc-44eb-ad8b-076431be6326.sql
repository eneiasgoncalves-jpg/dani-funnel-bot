ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS evolution_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS messages_evolution_id_unique ON public.messages (evolution_id) WHERE evolution_id IS NOT NULL;