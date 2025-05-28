-- migrate:skip
ALTER TABLE profiles ADD COLUMN caregiver_first_name TEXT;
ALTER TABLE profiles ADD COLUMN caregiver_last_name TEXT;
ALTER TABLE profiles ADD COLUMN caregiver_phone TEXT;
ALTER TABLE profiles ADD COLUMN caregiver_relationship TEXT;
ALTER TABLE profiles ADD COLUMN caregiver_email TEXT;
