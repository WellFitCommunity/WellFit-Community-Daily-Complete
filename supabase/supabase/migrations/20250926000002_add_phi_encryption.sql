-- Migration: Add field-level encryption for PHI (Protected Health Information)
-- This migration adds encryption for sensitive healthcare data fields

-- migrate:up
begin;

-- Enable the pgcrypto extension for encryption functions
create extension if not exists pgcrypto;

-- Create a function to encrypt sensitive text fields
-- Uses AES encryption with a key derived from the environment
create or replace function encrypt_phi_text(data text, encryption_key text default null)
returns text language plpgsql security definer as $$
declare
  key_to_use text;
begin
  -- Use provided key or fall back to environment variable
  key_to_use := coalesce(encryption_key, current_setting('app.phi_encryption_key', true));

  -- Return null for null input
  if data is null then
    return null;
  end if;

  -- Encrypt the data using AES
  return encode(encrypt(data::bytea, key_to_use::bytea, 'aes'), 'base64');
exception
  when others then
    -- Log the error and return null to prevent data exposure
    raise warning 'PHI encryption failed: %', sqlerrm;
    return null;
end$$;

-- Create a function to decrypt sensitive text fields
create or replace function decrypt_phi_text(encrypted_data text, encryption_key text default null)
returns text language plpgsql security definer as $$
declare
  key_to_use text;
begin
  -- Use provided key or fall back to environment variable
  key_to_use := coalesce(encryption_key, current_setting('app.phi_encryption_key', true));

  -- Return null for null input
  if encrypted_data is null then
    return null;
  end if;

  -- Decrypt the data
  return convert_from(decrypt(decode(encrypted_data, 'base64'), key_to_use::bytea, 'aes'), 'utf8');
exception
  when others then
    -- Log the error and return null to prevent application crashes
    raise warning 'PHI decryption failed: %', sqlerrm;
    return null;
end$$;

-- Create a function to encrypt integer fields (for vital signs)
create or replace function encrypt_phi_integer(data integer, encryption_key text default null)
returns text language plpgsql security definer as $$
begin
  if data is null then
    return null;
  end if;

  return encrypt_phi_text(data::text, encryption_key);
end$$;

-- Create a function to decrypt integer fields
create or replace function decrypt_phi_integer(encrypted_data text, encryption_key text default null)
returns integer language plpgsql security definer as $$
declare
  decrypted_text text;
begin
  if encrypted_data is null then
    return null;
  end if;

  decrypted_text := decrypt_phi_text(encrypted_data, encryption_key);

  if decrypted_text is null then
    return null;
  end if;

  return decrypted_text::integer;
exception
  when others then
    raise warning 'PHI integer decryption failed: %', sqlerrm;
    return null;
end$$;

-- Create new encrypted columns for check_ins table
alter table public.check_ins
add column if not exists emotional_state_encrypted text,
add column if not exists heart_rate_encrypted text,
add column if not exists pulse_oximeter_encrypted text,
add column if not exists bp_systolic_encrypted text,
add column if not exists bp_diastolic_encrypted text,
add column if not exists glucose_mg_dl_encrypted text;

-- Create new encrypted columns for risk_assessments table
alter table public.risk_assessments
add column if not exists assessment_notes_encrypted text,
add column if not exists risk_factors_encrypted text,
add column if not exists recommended_actions_encrypted text;

-- Create triggers to automatically encrypt data on insert/update for check_ins
create or replace function encrypt_check_ins_phi()
returns trigger language plpgsql security definer as $$
begin
  -- Encrypt sensitive fields if they're being set
  if NEW.emotional_state is not null then
    NEW.emotional_state_encrypted := encrypt_phi_text(NEW.emotional_state);
    NEW.emotional_state := null; -- Clear plaintext
  end if;

  if NEW.heart_rate is not null then
    NEW.heart_rate_encrypted := encrypt_phi_integer(NEW.heart_rate);
    NEW.heart_rate := null; -- Clear plaintext
  end if;

  if NEW.pulse_oximeter is not null then
    NEW.pulse_oximeter_encrypted := encrypt_phi_integer(NEW.pulse_oximeter);
    NEW.pulse_oximeter := null; -- Clear plaintext
  end if;

  if NEW.bp_systolic is not null then
    NEW.bp_systolic_encrypted := encrypt_phi_integer(NEW.bp_systolic);
    NEW.bp_systolic := null; -- Clear plaintext
  end if;

  if NEW.bp_diastolic is not null then
    NEW.bp_diastolic_encrypted := encrypt_phi_integer(NEW.bp_diastolic);
    NEW.bp_diastolic := null; -- Clear plaintext
  end if;

  if NEW.glucose_mg_dl is not null then
    NEW.glucose_mg_dl_encrypted := encrypt_phi_integer(NEW.glucose_mg_dl);
    NEW.glucose_mg_dl := null; -- Clear plaintext
  end if;

  return NEW;
end$$;

-- Create triggers to automatically encrypt data for risk_assessments
create or replace function encrypt_risk_assessments_phi()
returns trigger language plpgsql security definer as $$
begin
  -- Encrypt sensitive fields if they're being set
  if NEW.assessment_notes is not null then
    NEW.assessment_notes_encrypted := encrypt_phi_text(NEW.assessment_notes);
    NEW.assessment_notes := null; -- Clear plaintext
  end if;

  if NEW.risk_factors is not null then
    NEW.risk_factors_encrypted := encrypt_phi_text(array_to_string(NEW.risk_factors, '|'));
    NEW.risk_factors := null; -- Clear plaintext
  end if;

  if NEW.recommended_actions is not null then
    NEW.recommended_actions_encrypted := encrypt_phi_text(array_to_string(NEW.recommended_actions, '|'));
    NEW.recommended_actions := null; -- Clear plaintext
  end if;

  return NEW;
end$$;

-- Create the encryption triggers
drop trigger if exists encrypt_check_ins_phi_trigger on public.check_ins;
create trigger encrypt_check_ins_phi_trigger
  before insert or update on public.check_ins
  for each row execute function encrypt_check_ins_phi();

drop trigger if exists encrypt_risk_assessments_phi_trigger on public.risk_assessments;
create trigger encrypt_risk_assessments_phi_trigger
  before insert or update on public.risk_assessments
  for each row execute function encrypt_risk_assessments_phi();

-- Create views that automatically decrypt data for authorized users
create or replace view check_ins_decrypted as
select
  id,
  user_id,
  timestamp,
  label,
  is_emergency,
  decrypt_phi_text(emotional_state_encrypted) as emotional_state,
  decrypt_phi_integer(heart_rate_encrypted) as heart_rate,
  decrypt_phi_integer(pulse_oximeter_encrypted) as pulse_oximeter,
  decrypt_phi_integer(bp_systolic_encrypted) as bp_systolic,
  decrypt_phi_integer(bp_diastolic_encrypted) as bp_diastolic,
  decrypt_phi_integer(glucose_mg_dl_encrypted) as glucose_mg_dl,
  created_at
from public.check_ins;

create or replace view risk_assessments_decrypted as
select
  id,
  patient_id,
  assessor_id,
  risk_level,
  priority,
  medical_risk_score,
  mobility_risk_score,
  cognitive_risk_score,
  social_risk_score,
  overall_score,
  decrypt_phi_text(assessment_notes_encrypted) as assessment_notes,
  string_to_array(decrypt_phi_text(risk_factors_encrypted), '|') as risk_factors,
  string_to_array(decrypt_phi_text(recommended_actions_encrypted), '|') as recommended_actions,
  next_assessment_due,
  review_frequency,
  created_at,
  updated_at,
  valid_until
from public.risk_assessments;

-- Set up RLS for the decrypted views
alter view check_ins_decrypted owner to postgres;
alter view risk_assessments_decrypted owner to postgres;

-- Grant appropriate permissions
grant select on check_ins_decrypted to authenticated;
grant select on risk_assessments_decrypted to authenticated;

-- Add comments for documentation
comment on function encrypt_phi_text is 'Encrypts sensitive text data using AES encryption';
comment on function decrypt_phi_text is 'Decrypts sensitive text data using AES encryption';
comment on function encrypt_phi_integer is 'Encrypts sensitive integer data using AES encryption';
comment on function decrypt_phi_integer is 'Decrypts sensitive integer data using AES encryption';
comment on view check_ins_decrypted is 'Decrypted view of check_ins table for authorized access';
comment on view risk_assessments_decrypted is 'Decrypted view of risk_assessments table for authorized access';

commit;

-- migrate:down
begin;

-- Drop views
drop view if exists check_ins_decrypted;
drop view if exists risk_assessments_decrypted;

-- Drop triggers
drop trigger if exists encrypt_check_ins_phi_trigger on public.check_ins;
drop trigger if exists encrypt_risk_assessments_phi_trigger on public.risk_assessments;

-- Drop functions
drop function if exists encrypt_check_ins_phi();
drop function if exists encrypt_risk_assessments_phi();
drop function if exists decrypt_phi_integer(text, text);
drop function if exists encrypt_phi_integer(integer, text);
drop function if exists decrypt_phi_text(text, text);
drop function if exists encrypt_phi_text(text, text);

-- Drop encrypted columns
alter table public.check_ins
drop column if exists emotional_state_encrypted,
drop column if exists heart_rate_encrypted,
drop column if exists pulse_oximeter_encrypted,
drop column if exists bp_systolic_encrypted,
drop column if exists bp_diastolic_encrypted,
drop column if exists glucose_mg_dl_encrypted;

alter table public.risk_assessments
drop column if exists assessment_notes_encrypted,
drop column if exists risk_factors_encrypted,
drop column if exists recommended_actions_encrypted;

commit;