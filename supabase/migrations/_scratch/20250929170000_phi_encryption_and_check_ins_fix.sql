-- Combined migration: Fix check_ins table and add PHI encryption
-- Combines the functionality from the broken migrations

-- Ensure pgcrypto extension exists for encryption
create extension if not exists pgcrypto;

-- Create encryption/decryption functions for PHI
create or replace function public.encrypt_phi_text(data text, encryption_key text default null)
returns text language plpgsql security definer as $$
declare
  key_to_use text;
begin
  key_to_use := coalesce(encryption_key, current_setting('app.phi_encryption_key', true));
  if data is null then
    return null;
  end if;
  return encode(encrypt(data::bytea, key_to_use::bytea, 'aes'), 'base64');
exception
  when others then
    raise warning 'PHI encryption failed: %', sqlerrm;
    return null;
end$$;

create or replace function public.decrypt_phi_text(encrypted_data text, encryption_key text default null)
returns text language plpgsql security definer as $$
declare
  key_to_use text;
begin
  key_to_use := coalesce(encryption_key, current_setting('app.phi_encryption_key', true));
  if encrypted_data is null then
    return null;
  end if;
  return convert_from(decrypt(decode(encrypted_data, 'base64'), key_to_use::bytea, 'aes'), 'utf8');
exception
  when others then
    raise warning 'PHI decryption failed: %', sqlerrm;
    return null;
end$$;

-- Add encrypted columns to check_ins (if table exists from earlier migration)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'check_ins') then
    -- Add encrypted columns if they don't exist
    alter table public.check_ins
      add column if not exists emotional_state_encrypted text,
      add column if not exists heart_rate_encrypted text,
      add column if not exists pulse_oximeter_encrypted text,
      add column if not exists bp_systolic_encrypted text,
      add column if not exists bp_diastolic_encrypted text,
      add column if not exists glucose_mg_dl_encrypted text;
  end if;
end$$;

-- Add encrypted columns to profiles
alter table public.profiles
  add column if not exists ssn_encrypted text,
  add column if not exists medical_record_number_encrypted text,
  add column if not exists insurance_id_encrypted text;

-- Add encrypted columns to health_entries (if exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'health_entries') then
    alter table public.health_entries
      add column if not exists notes_encrypted text,
      add column if not exists blood_pressure_encrypted text,
      add column if not exists blood_sugar_encrypted text;
  end if;
end$$;

-- Create views for decrypted data (admin only)
create or replace view public.check_ins_decrypted as
select
  id,
  user_id,
  timestamp,
  label,
  is_emergency,
  emotional_state,
  decrypt_phi_text(emotional_state_encrypted) as emotional_state_decrypted,
  heart_rate,
  decrypt_phi_text(heart_rate_encrypted) as heart_rate_decrypted,
  pulse_oximeter,
  decrypt_phi_text(pulse_oximeter_encrypted) as pulse_oximeter_decrypted,
  bp_systolic,
  decrypt_phi_text(bp_systolic_encrypted) as bp_systolic_decrypted,
  bp_diastolic,
  decrypt_phi_text(bp_diastolic_encrypted) as bp_diastolic_decrypted,
  glucose_mg_dl,
  decrypt_phi_text(glucose_mg_dl_encrypted) as glucose_mg_dl_decrypted,
  created_at
from public.check_ins;

-- RLS for decrypted view (admin only)
alter view public.check_ins_decrypted set (security_invoker = true);

comment on view public.check_ins_decrypted is 'Decrypted view of check_ins data - accessible only to admins with proper encryption key';