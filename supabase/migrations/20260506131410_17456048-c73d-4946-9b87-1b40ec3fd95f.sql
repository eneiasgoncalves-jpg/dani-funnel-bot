
-- Add media columns to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS file_name text;

-- Create public bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket (public read + public write since app has no auth)
DO $$ BEGIN
  CREATE POLICY "Public read chat-attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'chat-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public insert chat-attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'chat-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public update chat-attachments"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'chat-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public delete chat-attachments"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'chat-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
