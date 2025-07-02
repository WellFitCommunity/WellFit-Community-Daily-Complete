-- Create admin_notes table
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id BIGSERIAL PRIMARY KEY,
  senior_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT, -- Admin user who wrote the note
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.admin_notes IS 'Stores notes written by admins about senior users.';
COMMENT ON COLUMN public.admin_notes.senior_id IS 'The ID of the senior user this note is about.';
COMMENT ON COLUMN public.admin_notes.created_by IS 'The ID of the admin user who created or last updated the note.';
COMMENT ON COLUMN public.admin_notes.note IS 'The content of the note.';

-- Trigger to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_admin_notes_updated_at
BEFORE UPDATE ON public.admin_notes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_notes_senior_id ON public.admin_notes(senior_id);
CREATE INDEX IF NOT EXISTS idx_admin_notes_created_by ON public.admin_notes(created_by);
