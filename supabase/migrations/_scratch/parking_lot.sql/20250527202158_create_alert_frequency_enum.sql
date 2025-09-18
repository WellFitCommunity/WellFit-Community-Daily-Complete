DO $$ BEGIN
  CREATE TYPE alert_frequency AS ENUM ('weekly', '2x a week', 'bi-weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
