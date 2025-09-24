-- Fix self_reports table to include missing form fields
-- This resolves the "invisible entries" issue where form data wasn't being saved

-- migrate:up
begin;

-- Add missing columns to self_reports table
alter table "public"."self_reports"
add column if not exists "blood_sugar" integer;

alter table "public"."self_reports"
add column if not exists "weight" numeric(6,2);

alter table "public"."self_reports"
add column if not exists "physical_activity" text;

alter table "public"."self_reports"
add column if not exists "social_engagement" text;

alter table "public"."self_reports"
add column if not exists "activity_description" text;

alter table "public"."self_reports"
add column if not exists "blood_oxygen" integer;

-- Add constraints
alter table "public"."self_reports" add constraint "self_reports_blood_sugar_check"
CHECK (blood_sugar is null or (blood_sugar >= 30 and blood_sugar <= 600)) not valid;
alter table "public"."self_reports" validate constraint "self_reports_blood_sugar_check";

alter table "public"."self_reports" add constraint "self_reports_weight_check"
CHECK (weight is null or (weight >= 50 and weight <= 800)) not valid;
alter table "public"."self_reports" validate constraint "self_reports_weight_check";

alter table "public"."self_reports" add constraint "self_reports_blood_oxygen_check"
CHECK (blood_oxygen is null or (blood_oxygen >= 50 and blood_oxygen <= 100)) not valid;
alter table "public"."self_reports" validate constraint "self_reports_blood_oxygen_check";

commit;

-- migrate:down
begin;

alter table "public"."self_reports" drop column if exists "activity_description";
alter table "public"."self_reports" drop column if exists "social_engagement";
alter table "public"."self_reports" drop column if exists "physical_activity";
alter table "public"."self_reports" drop column if exists "weight";
alter table "public"."self_reports" drop column if exists "blood_sugar";
alter table "public"."self_reports" drop column if exists "blood_oxygen";

commit;