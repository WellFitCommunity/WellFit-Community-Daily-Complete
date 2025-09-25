-- Add functional assessment fields to risk_assessments table
-- This enables comprehensive health assessments including mobility, ADLs, and fall risk

-- migrate:up
begin;

-- Add functional assessment columns to risk_assessments table
alter table "public"."risk_assessments"
add column if not exists "walking_ability" text;

alter table "public"."risk_assessments"
add column if not exists "stair_climbing" text;

alter table "public"."risk_assessments"
add column if not exists "sitting_ability" text;

alter table "public"."risk_assessments"
add column if not exists "standing_ability" text;

alter table "public"."risk_assessments"
add column if not exists "toilet_transfer" text;

alter table "public"."risk_assessments"
add column if not exists "bathing_ability" text;

alter table "public"."risk_assessments"
add column if not exists "meal_preparation" text;

alter table "public"."risk_assessments"
add column if not exists "medication_management" text;

alter table "public"."risk_assessments"
add column if not exists "fall_risk_factors" text[];

-- Add check constraints for functional assessment fields
alter table "public"."risk_assessments" add constraint "risk_assessments_walking_ability_check"
CHECK (walking_ability is null or walking_ability in ('independent', 'cane', 'assistance', 'wheelchair', 'bedbound')) not valid;
alter table "public"."risk_assessments" validate constraint "risk_assessments_walking_ability_check";

alter table "public"."risk_assessments" add constraint "risk_assessments_stair_climbing_check"
CHECK (stair_climbing is null or stair_climbing in ('independent', 'handrail', 'assistance', 'unable')) not valid;
alter table "public"."risk_assessments" validate constraint "risk_assessments_stair_climbing_check";

alter table "public"."risk_assessments" add constraint "risk_assessments_sitting_ability_check"
CHECK (sitting_ability is null or sitting_ability in ('independent', 'careful', 'assistance', 'unsafe')) not valid;
alter table "public"."risk_assessments" validate constraint "risk_assessments_sitting_ability_check";

alter table "public"."risk_assessments" add constraint "risk_assessments_standing_ability_check"
CHECK (standing_ability is null or standing_ability in ('independent', 'arms', 'assistance', 'unable')) not valid;
alter table "public"."risk_assessments" validate constraint "risk_assessments_standing_ability_check";

alter table "public"."risk_assessments" add constraint "risk_assessments_toilet_transfer_check"
CHECK (toilet_transfer is null or toilet_transfer in ('independent', 'grab_bars', 'assistance', 'unsafe')) not valid;
alter table "public"."risk_assessments" validate constraint "risk_assessments_toilet_transfer_check";

alter table "public"."risk_assessments" add constraint "risk_assessments_bathing_ability_check"
CHECK (bathing_ability is null or bathing_ability in ('independent', 'shower_chair', 'assistance', 'full_help')) not valid;
alter table "public"."risk_assessments" validate constraint "risk_assessments_bathing_ability_check";

alter table "public"."risk_assessments" add constraint "risk_assessments_meal_preparation_check"
CHECK (meal_preparation is null or meal_preparation in ('independent', 'simple', 'microwave', 'unable')) not valid;
alter table "public"."risk_assessments" validate constraint "risk_assessments_meal_preparation_check";

alter table "public"."risk_assessments" add constraint "risk_assessments_medication_management_check"
CHECK (medication_management is null or medication_management in ('independent', 'reminder', 'assistance', 'supervised')) not valid;
alter table "public"."risk_assessments" validate constraint "risk_assessments_medication_management_check";

commit;

-- migrate:down
begin;

-- Remove constraints
alter table "public"."risk_assessments" drop constraint if exists "risk_assessments_walking_ability_check";
alter table "public"."risk_assessments" drop constraint if exists "risk_assessments_stair_climbing_check";
alter table "public"."risk_assessments" drop constraint if exists "risk_assessments_sitting_ability_check";
alter table "public"."risk_assessments" drop constraint if exists "risk_assessments_standing_ability_check";
alter table "public"."risk_assessments" drop constraint if exists "risk_assessments_toilet_transfer_check";
alter table "public"."risk_assessments" drop constraint if exists "risk_assessments_bathing_ability_check";
alter table "public"."risk_assessments" drop constraint if exists "risk_assessments_meal_preparation_check";
alter table "public"."risk_assessments" drop constraint if exists "risk_assessments_medication_management_check";

-- Remove columns
alter table "public"."risk_assessments" drop column if exists "fall_risk_factors";
alter table "public"."risk_assessments" drop column if exists "medication_management";
alter table "public"."risk_assessments" drop column if exists "meal_preparation";
alter table "public"."risk_assessments" drop column if exists "bathing_ability";
alter table "public"."risk_assessments" drop column if exists "toilet_transfer";
alter table "public"."risk_assessments" drop column if exists "standing_ability";
alter table "public"."risk_assessments" drop column if exists "sitting_ability";
alter table "public"."risk_assessments" drop column if exists "stair_climbing";
alter table "public"."risk_assessments" drop column if exists "walking_ability";

commit;