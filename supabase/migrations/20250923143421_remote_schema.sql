create type "public"."alert_status" as enum ('open', 'acknowledged', 'dispatched', 'resolved', 'false_alarm', 'cancelled');

create type "public"."alert_type" as enum ('fall', 'medical', 'fire', 'sos', 'wellness_check', 'other');

create sequence "public"."_trigger_log_id_seq";

create sequence "public"."admin_enroll_audit_id_seq";

create sequence "public"."admin_notes_audit_id_seq";

create sequence "public"."caregiver_pin_attempts_id_seq";

create sequence "public"."caregiver_view_grants_id_seq";

create sequence "public"."check_ins_audit_id_seq";

create sequence "public"."geofence_events_id_seq";

create sequence "public"."geofence_zones_id_seq";

create sequence "public"."mobile_devices_id_seq";

create sequence "public"."mobile_emergency_contacts_id_seq";

create sequence "public"."mobile_emergency_incidents_id_seq";

create sequence "public"."mobile_sync_status_id_seq";

create sequence "public"."mobile_vitals_id_seq";

create sequence "public"."movement_patterns_id_seq";

create sequence "public"."patient_locations_id_seq";

create sequence "public"."rate_limit_admin_id_seq";

create sequence "public"."rate_limit_logins_id_seq";

create sequence "public"."rate_limit_registrations_id_seq";

create sequence "public"."roles_id_seq";

create sequence "public"."senior_emergency_contacts_id_seq";

alter table "public"."profiles" drop constraint "profiles_phone_key";

alter table "public"."user_roles" drop constraint "user_roles_pkey";

drop index if exists "public"."profiles_phone_key";

drop index if exists "public"."user_roles_pkey";

create table "public"."_trigger_log" (
    "id" bigint not null default nextval('_trigger_log_id_seq'::regclass),
    "at" timestamp with time zone not null default now(),
    "event" text,
    "detail" jsonb
);


create table "public"."admin_enroll_audit" (
    "id" bigint not null default nextval('admin_enroll_audit_id_seq'::regclass),
    "admin_id" uuid,
    "user_id" uuid,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."admin_enroll_audit" enable row level security;

create table "public"."admin_notes_audit" (
    "id" bigint not null default nextval('admin_notes_audit_id_seq'::regclass),
    "note_id" uuid,
    "action" text,
    "old_row" jsonb,
    "new_row" jsonb,
    "acted_by" uuid,
    "acted_at" timestamp with time zone default now()
);


alter table "public"."admin_notes_audit" enable row level security;

create table "public"."admin_pin_attempts_log" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "ip_address" text,
    "attempted_at" timestamp with time zone not null default now(),
    "success" boolean not null,
    "reason" text,
    "role_attempted" text,
    "user_agent" text
);


alter table "public"."admin_pin_attempts_log" enable row level security;

create table "public"."admin_user_questions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "message" text not null,
    "status" text default 'new'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."admin_user_questions" enable row level security;

create table "public"."admin_users" (
    "user_id" uuid not null,
    "role" text not null default 'admin'::text,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid
);


alter table "public"."admin_users" enable row level security;

create table "public"."alerts" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "title" text not null,
    "body" text,
    "priority" text default 'low'::text,
    "is_read" boolean default false,
    "created_at" timestamp with time zone default now(),
    "created_by" uuid
);


alter table "public"."alerts" enable row level security;

create table "public"."api_keys" (
    "id" uuid not null default gen_random_uuid(),
    "label" text not null,
    "key_hash" text not null,
    "created_by" uuid not null,
    "created_at" timestamp with time zone default now(),
    "revoked_at" timestamp with time zone
);


alter table "public"."api_keys" enable row level security;

create table "public"."caregiver_pin_attempts" (
    "id" bigint not null default nextval('caregiver_pin_attempts_id_seq'::regclass),
    "caregiver_user_id" uuid,
    "senior_user_id" uuid,
    "ts" timestamp with time zone not null default now(),
    "success" boolean not null,
    "client_ip" inet
);


alter table "public"."caregiver_pin_attempts" enable row level security;

create table "public"."caregiver_pins" (
    "senior_user_id" uuid not null,
    "pin_hash" text not null,
    "updated_at" timestamp with time zone not null default now(),
    "updated_by" uuid
);


alter table "public"."caregiver_pins" enable row level security;

create table "public"."caregiver_view_grants" (
    "id" bigint not null default nextval('caregiver_view_grants_id_seq'::regclass),
    "caregiver_user_id" uuid not null,
    "senior_user_id" uuid not null,
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now(),
    "last_used_at" timestamp with time zone
);


alter table "public"."caregiver_view_grants" enable row level security;

create table "public"."check_ins_audit" (
    "id" bigint not null default nextval('check_ins_audit_id_seq'::regclass),
    "check_in_id" uuid,
    "action" text,
    "old_row" jsonb,
    "new_row" jsonb,
    "acted_by" uuid,
    "acted_at" timestamp with time zone default now()
);


alter table "public"."check_ins_audit" enable row level security;

create table "public"."comment_reports" (
    "id" uuid not null default gen_random_uuid(),
    "comment_id" uuid not null,
    "reporter_id" uuid not null,
    "reason" text not null,
    "created_at" timestamp with time zone default now(),
    "status" text default 'new'::text,
    "user_id" uuid
);


alter table "public"."comment_reports" enable row level security;

create table "public"."comments" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "body" text not null,
    "created_at" timestamp with time zone default now(),
    "edited_at" timestamp with time zone
);


alter table "public"."comments" enable row level security;

create table "public"."consent_log" (
    "id" uuid not null default gen_random_uuid(),
    "document_type" text not null,
    "version" text not null,
    "signed_at" timestamp with time zone default now(),
    "ip_address" inet,
    "user_agent" text,
    "user_id" uuid
);


alter table "public"."consent_log" enable row level security;

create table "public"."fcm_tokens" (
    "user_id" uuid not null,
    "token" text not null,
    "created_at" timestamp with time zone default now(),
    "last_used_at" timestamp with time zone default now(),
    "device_info" text
);


alter table "public"."fcm_tokens" enable row level security;

create table "public"."geofence_events" (
    "id" bigint not null default nextval('geofence_events_id_seq'::regclass),
    "patient_id" uuid not null,
    "geofence_zone_id" bigint,
    "event_type" text not null,
    "latitude" double precision not null,
    "longitude" double precision not null,
    "distance_from_center" double precision,
    "duration_seconds" integer,
    "trigger_accuracy" double precision,
    "notification_sent" boolean default false,
    "emergency_alert_triggered" boolean default false,
    "occurred_at" timestamp with time zone not null,
    "created_at" timestamp with time zone default now()
);


alter table "public"."geofence_events" enable row level security;

create table "public"."geofence_zones" (
    "id" bigint not null default nextval('geofence_zones_id_seq'::regclass),
    "patient_id" uuid not null,
    "zone_name" text not null,
    "zone_type" text default 'safe_zone'::text,
    "center_latitude" double precision not null,
    "center_longitude" double precision not null,
    "radius_meters" double precision not null,
    "is_active" boolean default true,
    "notification_enabled" boolean default true,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."geofence_zones" enable row level security;

create table "public"."mobile_devices" (
    "id" bigint not null default nextval('mobile_devices_id_seq'::regclass),
    "patient_id" uuid not null,
    "device_id" text not null,
    "device_name" text,
    "device_model" text,
    "os_version" text,
    "app_version" text,
    "push_token" text,
    "has_gps" boolean default true,
    "has_camera" boolean default true,
    "has_accelerometer" boolean default false,
    "last_active_at" timestamp with time zone,
    "battery_level" integer,
    "is_charging" boolean,
    "network_type" text,
    "location_permission_granted" boolean default false,
    "camera_permission_granted" boolean default false,
    "notification_permission_granted" boolean default false,
    "registered_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."mobile_devices" enable row level security;

create table "public"."mobile_emergency_contacts" (
    "id" bigint not null default nextval('mobile_emergency_contacts_id_seq'::regclass),
    "patient_id" uuid not null,
    "contact_name" text not null,
    "contact_phone" text not null,
    "contact_email" text,
    "relationship" text,
    "priority_order" integer default 1,
    "call_enabled" boolean default true,
    "sms_enabled" boolean default true,
    "email_enabled" boolean default false,
    "last_contacted_at" timestamp with time zone,
    "total_notifications_sent" integer default 0,
    "average_response_time_minutes" integer,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."mobile_emergency_contacts" enable row level security;

create table "public"."mobile_emergency_incidents" (
    "id" bigint not null default nextval('mobile_emergency_incidents_id_seq'::regclass),
    "patient_id" uuid not null,
    "incident_type" text not null,
    "severity" text not null default 'medium'::text,
    "auto_detected" boolean default false,
    "location_latitude" double precision,
    "location_longitude" double precision,
    "location_accuracy" double precision,
    "vital_signs" jsonb,
    "description" text,
    "notification_sent_at" timestamp with time zone,
    "emergency_contacts_notified" integer default 0,
    "first_responder_alerted" boolean default false,
    "incident_resolved" boolean default false,
    "resolved_at" timestamp with time zone,
    "resolved_by" uuid,
    "resolution_notes" text,
    "triggered_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone default now()
);


alter table "public"."mobile_emergency_incidents" enable row level security;

create table "public"."mobile_sync_status" (
    "id" bigint not null default nextval('mobile_sync_status_id_seq'::regclass),
    "patient_id" uuid not null,
    "device_id" text not null,
    "data_type" text not null,
    "last_sync_at" timestamp with time zone,
    "pending_upload_count" integer default 0,
    "last_successful_upload" timestamp with time zone,
    "sync_errors" jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."mobile_sync_status" enable row level security;

create table "public"."mobile_vitals" (
    "id" bigint not null default nextval('mobile_vitals_id_seq'::regclass),
    "patient_id" uuid not null,
    "measurement_type" text not null,
    "value_primary" double precision not null,
    "value_secondary" double precision,
    "unit" text not null,
    "measurement_method" text,
    "device_info" jsonb,
    "measurement_quality" text,
    "confidence_score" integer,
    "environmental_factors" jsonb,
    "measured_at" timestamp with time zone not null,
    "created_at" timestamp with time zone default now()
);


alter table "public"."mobile_vitals" enable row level security;

create table "public"."movement_patterns" (
    "id" bigint not null default nextval('movement_patterns_id_seq'::regclass),
    "patient_id" uuid not null,
    "date_tracked" date not null,
    "total_distance_meters" double precision default 0,
    "active_time_minutes" integer default 0,
    "sedentary_time_minutes" integer default 0,
    "locations_visited" integer default 0,
    "max_distance_from_home" double precision default 0,
    "movement_regularity_score" integer,
    "unusual_activity_detected" boolean default false,
    "activity_level" text,
    "hourly_activity" jsonb,
    "confined_to_home" boolean default false,
    "wandering_detected" boolean default false,
    "irregular_sleep_pattern" boolean default false,
    "analyzed_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now()
);


alter table "public"."movement_patterns" enable row level security;

create table "public"."patient_locations" (
    "id" bigint not null default nextval('patient_locations_id_seq'::regclass),
    "patient_id" uuid not null,
    "latitude" double precision not null,
    "longitude" double precision not null,
    "accuracy" double precision,
    "altitude" double precision,
    "speed" double precision,
    "heading" double precision,
    "location_source" text default 'gps'::text,
    "is_significant_change" boolean default false,
    "battery_level" integer,
    "recorded_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone default now()
);


alter table "public"."patient_locations" enable row level security;

create table "public"."push_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "fcm_token" text not null,
    "platform" text default 'web'::text,
    "last_seen" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."push_subscriptions" enable row level security;

create table "public"."rate_limit_admin" (
    "id" bigint not null default nextval('rate_limit_admin_id_seq'::regclass),
    "key" text not null,
    "attempted_at" timestamp with time zone not null default now()
);


alter table "public"."rate_limit_admin" enable row level security;

create table "public"."rate_limit_logins" (
    "id" bigint not null default nextval('rate_limit_logins_id_seq'::regclass),
    "ip_address" text not null,
    "attempted_at" timestamp with time zone not null default now()
);


create table "public"."rate_limit_registrations" (
    "id" bigint not null default nextval('rate_limit_registrations_id_seq'::regclass),
    "ip_address" text not null,
    "attempted_at" timestamp with time zone not null default now()
);


alter table "public"."rate_limit_registrations" enable row level security;

create table "public"."roles" (
    "id" integer not null default nextval('roles_id_seq'::regclass),
    "name" text not null
);


alter table "public"."roles" enable row level security;

create table "public"."self_reports" (
    "id" uuid not null default gen_random_uuid(),
    "bp_systolic" integer,
    "bp_diastolic" integer,
    "heart_rate" integer,
    "spo2" integer,
    "mood" text,
    "symptoms" text,
    "created_at" timestamp with time zone default now(),
    "user_id" uuid
);


alter table "public"."self_reports" enable row level security;

create table "public"."senior_demographics" (
    "user_id" uuid not null,
    "gender_identity" text,
    "ethnicity" text,
    "marital_status" text,
    "lives_with" text,
    "education_level" text,
    "income_range" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."senior_demographics" enable row level security;

create table "public"."senior_emergency_contacts" (
    "id" bigint not null default nextval('senior_emergency_contacts_id_seq'::regclass),
    "user_id" uuid not null,
    "name" text not null,
    "relationship" text,
    "phone" text,
    "is_primary" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."senior_emergency_contacts" enable row level security;

create table "public"."senior_health" (
    "user_id" uuid not null,
    "insurance_types" text[] not null default '{}'::text[],
    "conditions" text[] not null default '{}'::text[],
    "mobility_level" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."senior_health" enable row level security;

create table "public"."senior_sdoh" (
    "user_id" uuid not null,
    "transportation_access" text,
    "food_security" text,
    "social_support_loneliness" text,
    "technology_comfort" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."senior_sdoh" enable row level security;

create table "public"."user_roles_audit" (
    "audit_id" uuid not null default gen_random_uuid(),
    "deleted_at" timestamp with time zone default now(),
    "deleted_by" uuid,
    "old_user_id" uuid,
    "old_role_id" uuid
);


alter table "public"."user_roles_audit" enable row level security;

alter table "public"."profiles" drop column "demographics_complete";

alter table "public"."profiles" drop column "verified_at";

alter table "public"."profiles" add column "city" text;

alter table "public"."profiles" add column "disabled_at" timestamp with time zone;

alter table "public"."profiles" add column "disabled_by" uuid;

alter table "public"."profiles" add column "disabled_reason" text;

alter table "public"."profiles" add column "email_opt_out" boolean not null default false;

alter table "public"."profiles" add column "ethnicity" text;

alter table "public"."profiles" add column "gender" text;

alter table "public"."profiles" add column "id" uuid generated always as (user_id) stored;

alter table "public"."profiles" add column "last_inactive_nag_at" timestamp with time zone;

alter table "public"."profiles" add column "password_hash" text;

alter table "public"."profiles" add column "race" text;

alter table "public"."profiles" add column "role_id" integer not null;

alter table "public"."profiles" add column "state" text;

alter table "public"."profiles" add column "zip_code" text;

alter table "public"."profiles" alter column "consent" drop default;

alter table "public"."profiles" alter column "consent" drop not null;

alter table "public"."profiles" alter column "created_at" drop not null;

alter table "public"."profiles" alter column "email_verified" drop not null;

alter table "public"."profiles" alter column "force_password_change" drop not null;

alter table "public"."profiles" alter column "onboarded" drop not null;

alter table "public"."profiles" alter column "phone_verified" drop not null;

alter table "public"."profiles" alter column "role" drop default;

alter table "public"."profiles" alter column "role_code" drop default;

alter table "public"."user_roles" drop column "created_at";

alter table "public"."user_roles" add column "role_id" integer not null;

alter table "public"."user_roles" alter column "role" drop not null;

alter sequence "public"."_trigger_log_id_seq" owned by "public"."_trigger_log"."id";

alter sequence "public"."admin_enroll_audit_id_seq" owned by "public"."admin_enroll_audit"."id";

alter sequence "public"."admin_notes_audit_id_seq" owned by "public"."admin_notes_audit"."id";

alter sequence "public"."caregiver_pin_attempts_id_seq" owned by "public"."caregiver_pin_attempts"."id";

alter sequence "public"."caregiver_view_grants_id_seq" owned by "public"."caregiver_view_grants"."id";

alter sequence "public"."check_ins_audit_id_seq" owned by "public"."check_ins_audit"."id";

alter sequence "public"."geofence_events_id_seq" owned by "public"."geofence_events"."id";

alter sequence "public"."geofence_zones_id_seq" owned by "public"."geofence_zones"."id";

alter sequence "public"."mobile_devices_id_seq" owned by "public"."mobile_devices"."id";

alter sequence "public"."mobile_emergency_contacts_id_seq" owned by "public"."mobile_emergency_contacts"."id";

alter sequence "public"."mobile_emergency_incidents_id_seq" owned by "public"."mobile_emergency_incidents"."id";

alter sequence "public"."mobile_sync_status_id_seq" owned by "public"."mobile_sync_status"."id";

alter sequence "public"."mobile_vitals_id_seq" owned by "public"."mobile_vitals"."id";

alter sequence "public"."movement_patterns_id_seq" owned by "public"."movement_patterns"."id";

alter sequence "public"."patient_locations_id_seq" owned by "public"."patient_locations"."id";

alter sequence "public"."rate_limit_admin_id_seq" owned by "public"."rate_limit_admin"."id";

alter sequence "public"."rate_limit_logins_id_seq" owned by "public"."rate_limit_logins"."id";

alter sequence "public"."rate_limit_registrations_id_seq" owned by "public"."rate_limit_registrations"."id";

alter sequence "public"."roles_id_seq" owned by "public"."roles"."id";

alter sequence "public"."senior_emergency_contacts_id_seq" owned by "public"."senior_emergency_contacts"."id";

CREATE UNIQUE INDEX _trigger_log_pkey ON public._trigger_log USING btree (id);

CREATE UNIQUE INDEX admin_enroll_audit_pkey ON public.admin_enroll_audit USING btree (id);

CREATE UNIQUE INDEX admin_notes_audit_pkey ON public.admin_notes_audit USING btree (id);

CREATE UNIQUE INDEX admin_pin_attempts_log_pkey ON public.admin_pin_attempts_log USING btree (id);

CREATE UNIQUE INDEX admin_users_pkey ON public.admin_users USING btree (user_id);

CREATE UNIQUE INDEX alerts_pkey ON public.alerts USING btree (id);

CREATE UNIQUE INDEX api_keys_pkey ON public.api_keys USING btree (id);

CREATE UNIQUE INDEX caregiver_pin_attempts_pkey ON public.caregiver_pin_attempts USING btree (id);

CREATE UNIQUE INDEX caregiver_pins_pkey ON public.caregiver_pins USING btree (senior_user_id);

CREATE UNIQUE INDEX caregiver_view_grants_pkey ON public.caregiver_view_grants USING btree (id);

CREATE INDEX cg_attempts_idx ON public.caregiver_pin_attempts USING btree (caregiver_user_id, senior_user_id, ts);

CREATE INDEX cg_grants_active ON public.caregiver_view_grants USING btree (senior_user_id, expires_at);

CREATE INDEX cg_grants_by_pair ON public.caregiver_view_grants USING btree (caregiver_user_id, senior_user_id);

CREATE INDEX cg_grants_by_senior ON public.caregiver_view_grants USING btree (senior_user_id);

CREATE UNIQUE INDEX check_ins_audit_pkey ON public.check_ins_audit USING btree (id);

CREATE UNIQUE INDEX comment_reports_pkey ON public.comment_reports USING btree (id);

CREATE UNIQUE INDEX comments_pkey ON public.comments USING btree (id);

CREATE UNIQUE INDEX consent_log_pkey ON public.consent_log USING btree (id);

CREATE UNIQUE INDEX fcm_tokens_pkey ON public.fcm_tokens USING btree (user_id, token);

CREATE UNIQUE INDEX fcm_tokens_token_unique_idx ON public.fcm_tokens USING btree (token);

CREATE UNIQUE INDEX geofence_events_pkey ON public.geofence_events USING btree (id);

CREATE UNIQUE INDEX geofence_zones_pkey ON public.geofence_zones USING btree (id);

CREATE INDEX idx_admin_pin_attempts_log_attempted_at ON public.admin_pin_attempts_log USING btree (attempted_at DESC);

CREATE INDEX idx_admin_pin_attempts_log_ip_address ON public.admin_pin_attempts_log USING btree (ip_address);

CREATE INDEX idx_admin_pin_attempts_log_user_id ON public.admin_pin_attempts_log USING btree (user_id);

CREATE INDEX idx_emergency_incidents_patient_time ON public.mobile_emergency_incidents USING btree (patient_id, triggered_at DESC);

CREATE INDEX idx_geofence_events_patient_time ON public.geofence_events USING btree (patient_id, occurred_at DESC);

CREATE INDEX idx_mobile_vitals_patient_time ON public.mobile_vitals USING btree (patient_id, measured_at DESC);

CREATE INDEX idx_mobile_vitals_type ON public.mobile_vitals USING btree (measurement_type);

CREATE INDEX idx_movement_patterns_patient_date ON public.movement_patterns USING btree (patient_id, date_tracked DESC);

CREATE INDEX idx_patient_locations_coords ON public.patient_locations USING btree (latitude, longitude);

CREATE INDEX idx_patient_locations_patient_time ON public.patient_locations USING btree (patient_id, recorded_at DESC);

CREATE INDEX idx_rate_limit_logins_ip_time ON public.rate_limit_logins USING btree (ip_address, attempted_at DESC);

CREATE INDEX idx_roles_name ON public.roles USING btree (name);

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role_id);

CREATE INDEX idx_user_roles_role_id ON public.user_roles USING btree (role_id);

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);

CREATE UNIQUE INDEX mobile_devices_device_id_key ON public.mobile_devices USING btree (device_id);

CREATE UNIQUE INDEX mobile_devices_pkey ON public.mobile_devices USING btree (id);

CREATE UNIQUE INDEX mobile_emergency_contacts_pkey ON public.mobile_emergency_contacts USING btree (id);

CREATE UNIQUE INDEX mobile_emergency_incidents_pkey ON public.mobile_emergency_incidents USING btree (id);

CREATE UNIQUE INDEX mobile_sync_status_patient_id_device_id_data_type_key ON public.mobile_sync_status USING btree (patient_id, device_id, data_type);

CREATE UNIQUE INDEX mobile_sync_status_pkey ON public.mobile_sync_status USING btree (id);

CREATE UNIQUE INDEX mobile_vitals_pkey ON public.mobile_vitals USING btree (id);

CREATE UNIQUE INDEX movement_patterns_patient_id_date_tracked_key ON public.movement_patterns USING btree (patient_id, date_tracked);

CREATE UNIQUE INDEX movement_patterns_pkey ON public.movement_patterns USING btree (id);

CREATE UNIQUE INDEX patient_locations_pkey ON public.patient_locations USING btree (id);

CREATE INDEX profiles_id_idx ON public.profiles USING btree (id);

CREATE UNIQUE INDEX push_subscriptions_pkey ON public.push_subscriptions USING btree (id);

CREATE UNIQUE INDEX push_subscriptions_user_id_fcm_token_key ON public.push_subscriptions USING btree (user_id, fcm_token);

CREATE UNIQUE INDEX rate_limit_admin_pkey ON public.rate_limit_admin USING btree (id);

CREATE UNIQUE INDEX rate_limit_logins_pkey ON public.rate_limit_logins USING btree (id);

CREATE INDEX rate_limit_registrations_ip_time_idx ON public.rate_limit_registrations USING btree (ip_address, attempted_at DESC);

CREATE UNIQUE INDEX rate_limit_registrations_pkey ON public.rate_limit_registrations USING btree (id);

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);

CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id);

CREATE INDEX sec_user_idx ON public.senior_emergency_contacts USING btree (user_id);

CREATE UNIQUE INDEX self_reports_pkey ON public.self_reports USING btree (id);

CREATE UNIQUE INDEX senior_demographics_pkey ON public.senior_demographics USING btree (user_id);

CREATE UNIQUE INDEX senior_emergency_contacts_pkey ON public.senior_emergency_contacts USING btree (id);

CREATE UNIQUE INDEX senior_health_pkey ON public.senior_health USING btree (user_id);

CREATE UNIQUE INDEX senior_sdoh_pkey ON public.senior_sdoh USING btree (user_id);

CREATE UNIQUE INDEX user_questions_pkey ON public.admin_user_questions USING btree (id);

CREATE UNIQUE INDEX user_roles_audit_pkey ON public.user_roles_audit USING btree (audit_id);

CREATE UNIQUE INDEX user_roles_user_role_uidx ON public.user_roles USING btree (user_id, role);

CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (user_id);

alter table "public"."_trigger_log" add constraint "_trigger_log_pkey" PRIMARY KEY using index "_trigger_log_pkey";

alter table "public"."admin_enroll_audit" add constraint "admin_enroll_audit_pkey" PRIMARY KEY using index "admin_enroll_audit_pkey";

alter table "public"."admin_notes_audit" add constraint "admin_notes_audit_pkey" PRIMARY KEY using index "admin_notes_audit_pkey";

alter table "public"."admin_pin_attempts_log" add constraint "admin_pin_attempts_log_pkey" PRIMARY KEY using index "admin_pin_attempts_log_pkey";

alter table "public"."admin_user_questions" add constraint "user_questions_pkey" PRIMARY KEY using index "user_questions_pkey";

alter table "public"."admin_users" add constraint "admin_users_pkey" PRIMARY KEY using index "admin_users_pkey";

alter table "public"."alerts" add constraint "alerts_pkey" PRIMARY KEY using index "alerts_pkey";

alter table "public"."api_keys" add constraint "api_keys_pkey" PRIMARY KEY using index "api_keys_pkey";

alter table "public"."caregiver_pin_attempts" add constraint "caregiver_pin_attempts_pkey" PRIMARY KEY using index "caregiver_pin_attempts_pkey";

alter table "public"."caregiver_pins" add constraint "caregiver_pins_pkey" PRIMARY KEY using index "caregiver_pins_pkey";

alter table "public"."caregiver_view_grants" add constraint "caregiver_view_grants_pkey" PRIMARY KEY using index "caregiver_view_grants_pkey";

alter table "public"."check_ins_audit" add constraint "check_ins_audit_pkey" PRIMARY KEY using index "check_ins_audit_pkey";

alter table "public"."comment_reports" add constraint "comment_reports_pkey" PRIMARY KEY using index "comment_reports_pkey";

alter table "public"."comments" add constraint "comments_pkey" PRIMARY KEY using index "comments_pkey";

alter table "public"."consent_log" add constraint "consent_log_pkey" PRIMARY KEY using index "consent_log_pkey";

alter table "public"."fcm_tokens" add constraint "fcm_tokens_pkey" PRIMARY KEY using index "fcm_tokens_pkey";

alter table "public"."geofence_events" add constraint "geofence_events_pkey" PRIMARY KEY using index "geofence_events_pkey";

alter table "public"."geofence_zones" add constraint "geofence_zones_pkey" PRIMARY KEY using index "geofence_zones_pkey";

alter table "public"."mobile_devices" add constraint "mobile_devices_pkey" PRIMARY KEY using index "mobile_devices_pkey";

alter table "public"."mobile_emergency_contacts" add constraint "mobile_emergency_contacts_pkey" PRIMARY KEY using index "mobile_emergency_contacts_pkey";

alter table "public"."mobile_emergency_incidents" add constraint "mobile_emergency_incidents_pkey" PRIMARY KEY using index "mobile_emergency_incidents_pkey";

alter table "public"."mobile_sync_status" add constraint "mobile_sync_status_pkey" PRIMARY KEY using index "mobile_sync_status_pkey";

alter table "public"."mobile_vitals" add constraint "mobile_vitals_pkey" PRIMARY KEY using index "mobile_vitals_pkey";

alter table "public"."movement_patterns" add constraint "movement_patterns_pkey" PRIMARY KEY using index "movement_patterns_pkey";

alter table "public"."patient_locations" add constraint "patient_locations_pkey" PRIMARY KEY using index "patient_locations_pkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY using index "push_subscriptions_pkey";

alter table "public"."rate_limit_admin" add constraint "rate_limit_admin_pkey" PRIMARY KEY using index "rate_limit_admin_pkey";

alter table "public"."rate_limit_logins" add constraint "rate_limit_logins_pkey" PRIMARY KEY using index "rate_limit_logins_pkey";

alter table "public"."rate_limit_registrations" add constraint "rate_limit_registrations_pkey" PRIMARY KEY using index "rate_limit_registrations_pkey";

alter table "public"."roles" add constraint "roles_pkey" PRIMARY KEY using index "roles_pkey";

alter table "public"."self_reports" add constraint "self_reports_pkey" PRIMARY KEY using index "self_reports_pkey";

alter table "public"."senior_demographics" add constraint "senior_demographics_pkey" PRIMARY KEY using index "senior_demographics_pkey";

alter table "public"."senior_emergency_contacts" add constraint "senior_emergency_contacts_pkey" PRIMARY KEY using index "senior_emergency_contacts_pkey";

alter table "public"."senior_health" add constraint "senior_health_pkey" PRIMARY KEY using index "senior_health_pkey";

alter table "public"."senior_sdoh" add constraint "senior_sdoh_pkey" PRIMARY KEY using index "senior_sdoh_pkey";

alter table "public"."user_roles_audit" add constraint "user_roles_audit_pkey" PRIMARY KEY using index "user_roles_audit_pkey";

alter table "public"."user_roles" add constraint "user_roles_pkey" PRIMARY KEY using index "user_roles_pkey";

alter table "public"."admin_enroll_audit" add constraint "admin_enroll_audit_admin_id_fkey" FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."admin_enroll_audit" validate constraint "admin_enroll_audit_admin_id_fkey";

alter table "public"."admin_enroll_audit" add constraint "admin_enroll_audit_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."admin_enroll_audit" validate constraint "admin_enroll_audit_user_id_fkey";

alter table "public"."admin_notes_audit" add constraint "admin_notes_audit_action_check" CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]))) not valid;

alter table "public"."admin_notes_audit" validate constraint "admin_notes_audit_action_check";

alter table "public"."admin_pin_attempts_log" add constraint "admin_pin_attempts_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."admin_pin_attempts_log" validate constraint "admin_pin_attempts_log_user_id_fkey";

alter table "public"."admin_user_questions" add constraint "user_questions_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'answered'::text, 'closed'::text]))) not valid;

alter table "public"."admin_user_questions" validate constraint "user_questions_status_check";

alter table "public"."admin_user_questions" add constraint "user_questions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."admin_user_questions" validate constraint "user_questions_user_id_fkey";

alter table "public"."admin_users" add constraint "admin_users_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'super_admin'::text]))) not valid;

alter table "public"."admin_users" validate constraint "admin_users_role_check";

alter table "public"."admin_users" add constraint "admin_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."admin_users" validate constraint "admin_users_user_id_fkey";

alter table "public"."alerts" add constraint "alerts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."alerts" validate constraint "alerts_created_by_fkey";

alter table "public"."alerts" add constraint "alerts_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))) not valid;

alter table "public"."alerts" validate constraint "alerts_priority_check";

alter table "public"."alerts" add constraint "alerts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."alerts" validate constraint "alerts_user_id_fkey";

alter table "public"."api_keys" add constraint "api_keys_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."api_keys" validate constraint "api_keys_created_by_fkey";

alter table "public"."caregiver_pin_attempts" add constraint "caregiver_pin_attempts_caregiver_user_id_fkey" FOREIGN KEY (caregiver_user_id) REFERENCES auth.users(id) not valid;

alter table "public"."caregiver_pin_attempts" validate constraint "caregiver_pin_attempts_caregiver_user_id_fkey";

alter table "public"."caregiver_pin_attempts" add constraint "caregiver_pin_attempts_senior_user_id_fkey" FOREIGN KEY (senior_user_id) REFERENCES auth.users(id) not valid;

alter table "public"."caregiver_pin_attempts" validate constraint "caregiver_pin_attempts_senior_user_id_fkey";

alter table "public"."caregiver_pins" add constraint "caregiver_pins_senior_user_id_fkey" FOREIGN KEY (senior_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."caregiver_pins" validate constraint "caregiver_pins_senior_user_id_fkey";

alter table "public"."caregiver_pins" add constraint "caregiver_pins_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) not valid;

alter table "public"."caregiver_pins" validate constraint "caregiver_pins_updated_by_fkey";

alter table "public"."caregiver_view_grants" add constraint "caregiver_view_grants_caregiver_user_id_fkey" FOREIGN KEY (caregiver_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."caregiver_view_grants" validate constraint "caregiver_view_grants_caregiver_user_id_fkey";

alter table "public"."caregiver_view_grants" add constraint "caregiver_view_grants_senior_user_id_fkey" FOREIGN KEY (senior_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."caregiver_view_grants" validate constraint "caregiver_view_grants_senior_user_id_fkey";

alter table "public"."check_ins_audit" add constraint "check_ins_audit_action_check" CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]))) not valid;

alter table "public"."check_ins_audit" validate constraint "check_ins_audit_action_check";

alter table "public"."comment_reports" add constraint "comment_reports_comment_id_fkey" FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE not valid;

alter table "public"."comment_reports" validate constraint "comment_reports_comment_id_fkey";

alter table "public"."comment_reports" add constraint "comment_reports_reporter_id_fkey" FOREIGN KEY (reporter_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."comment_reports" validate constraint "comment_reports_reporter_id_fkey";

alter table "public"."comment_reports" add constraint "comment_reports_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text]))) not valid;

alter table "public"."comment_reports" validate constraint "comment_reports_status_check";

alter table "public"."comment_reports" add constraint "comment_reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."comment_reports" validate constraint "comment_reports_user_id_fkey";

alter table "public"."comments" add constraint "comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_user_id_fkey";

alter table "public"."consent_log" add constraint "consent_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."consent_log" validate constraint "consent_log_user_id_fkey";

alter table "public"."fcm_tokens" add constraint "fcm_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."fcm_tokens" validate constraint "fcm_tokens_user_id_fkey";

alter table "public"."geofence_events" add constraint "geofence_events_geofence_zone_id_fkey" FOREIGN KEY (geofence_zone_id) REFERENCES geofence_zones(id) ON DELETE CASCADE not valid;

alter table "public"."geofence_events" validate constraint "geofence_events_geofence_zone_id_fkey";

alter table "public"."geofence_events" add constraint "geofence_events_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."geofence_events" validate constraint "geofence_events_patient_id_fkey";

alter table "public"."geofence_zones" add constraint "geofence_zones_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."geofence_zones" validate constraint "geofence_zones_created_by_fkey";

alter table "public"."geofence_zones" add constraint "geofence_zones_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."geofence_zones" validate constraint "geofence_zones_patient_id_fkey";

alter table "public"."mobile_devices" add constraint "mobile_devices_device_id_key" UNIQUE using index "mobile_devices_device_id_key";

alter table "public"."mobile_devices" add constraint "mobile_devices_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."mobile_devices" validate constraint "mobile_devices_patient_id_fkey";

alter table "public"."mobile_emergency_contacts" add constraint "mobile_emergency_contacts_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."mobile_emergency_contacts" validate constraint "mobile_emergency_contacts_patient_id_fkey";

alter table "public"."mobile_emergency_incidents" add constraint "mobile_emergency_incidents_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."mobile_emergency_incidents" validate constraint "mobile_emergency_incidents_patient_id_fkey";

alter table "public"."mobile_emergency_incidents" add constraint "mobile_emergency_incidents_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id) not valid;

alter table "public"."mobile_emergency_incidents" validate constraint "mobile_emergency_incidents_resolved_by_fkey";

alter table "public"."mobile_sync_status" add constraint "mobile_sync_status_patient_id_device_id_data_type_key" UNIQUE using index "mobile_sync_status_patient_id_device_id_data_type_key";

alter table "public"."mobile_sync_status" add constraint "mobile_sync_status_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."mobile_sync_status" validate constraint "mobile_sync_status_patient_id_fkey";

alter table "public"."mobile_vitals" add constraint "mobile_vitals_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."mobile_vitals" validate constraint "mobile_vitals_patient_id_fkey";

alter table "public"."movement_patterns" add constraint "movement_patterns_patient_id_date_tracked_key" UNIQUE using index "movement_patterns_patient_id_date_tracked_key";

alter table "public"."movement_patterns" add constraint "movement_patterns_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."movement_patterns" validate constraint "movement_patterns_patient_id_fkey";

alter table "public"."patient_locations" add constraint "patient_locations_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."patient_locations" validate constraint "patient_locations_patient_id_fkey";

alter table "public"."profiles" add constraint "profiles_role_id_fkey" FOREIGN KEY (role_id) REFERENCES roles(id) not valid;

alter table "public"."profiles" validate constraint "profiles_role_id_fkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_fcm_token_key" UNIQUE using index "push_subscriptions_user_id_fcm_token_key";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."push_subscriptions" validate constraint "push_subscriptions_user_id_fkey";

alter table "public"."roles" add constraint "roles_name_key" UNIQUE using index "roles_name_key";

alter table "public"."self_reports" add constraint "self_reports_bp_diastolic_check" CHECK (((bp_diastolic >= 40) AND (bp_diastolic <= 160))) not valid;

alter table "public"."self_reports" validate constraint "self_reports_bp_diastolic_check";

alter table "public"."self_reports" add constraint "self_reports_bp_systolic_check" CHECK (((bp_systolic >= 60) AND (bp_systolic <= 260))) not valid;

alter table "public"."self_reports" validate constraint "self_reports_bp_systolic_check";

alter table "public"."self_reports" add constraint "self_reports_heart_rate_check" CHECK (((heart_rate >= 20) AND (heart_rate <= 250))) not valid;

alter table "public"."self_reports" validate constraint "self_reports_heart_rate_check";

alter table "public"."self_reports" add constraint "self_reports_spo2_check" CHECK (((spo2 >= 50) AND (spo2 <= 100))) not valid;

alter table "public"."self_reports" validate constraint "self_reports_spo2_check";

alter table "public"."self_reports" add constraint "self_reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."self_reports" validate constraint "self_reports_user_id_fkey";

alter table "public"."senior_demographics" add constraint "senior_demographics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."senior_demographics" validate constraint "senior_demographics_user_id_fkey";

alter table "public"."senior_emergency_contacts" add constraint "senior_emergency_contacts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."senior_emergency_contacts" validate constraint "senior_emergency_contacts_user_id_fkey";

alter table "public"."senior_health" add constraint "senior_health_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."senior_health" validate constraint "senior_health_user_id_fkey";

alter table "public"."senior_sdoh" add constraint "senior_sdoh_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."senior_sdoh" validate constraint "senior_sdoh_user_id_fkey";

alter table "public"."user_roles" add constraint "user_roles_role_id_fkey" FOREIGN KEY (role_id) REFERENCES roles(id) not valid;

alter table "public"."user_roles" validate constraint "user_roles_role_id_fkey";

alter table "public"."user_roles_audit" add constraint "user_roles_audit_deleted_by_fkey" FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."user_roles_audit" validate constraint "user_roles_audit_deleted_by_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN NEW.updated_at := now(); RETURN NEW; END$function$
;

create or replace view "public"."admin_user_auth_status" as  SELECT id AS user_id,
    email,
    phone,
    (encrypted_password IS NOT NULL) AS has_password
   FROM auth.users u;


CREATE OR REPLACE FUNCTION public.caregiver_has_grant(p_senior uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.caregiver_view_grants g
    WHERE g.caregiver_user_id = auth.uid()
      AND g.senior_user_id = p_senior
      AND g.expires_at > now()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.caregiver_verify_pin(p_senior_identifier text, p_pin text, p_ttl_minutes integer DEFAULT 120, p_client_ip inet DEFAULT NULL::inet)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  caregiver uuid := auth.uid();
  senior_id uuid;
  hash text;
  ok boolean := false;
  too_many boolean;
BEGIN
  IF caregiver IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Resolve senior (accept uuid string, phone, or email)
  SELECT id INTO senior_id
  FROM auth.users
  WHERE id::text = p_senior_identifier
     OR phone = p_senior_identifier
     OR lower(email) = lower(p_senior_identifier)
  LIMIT 1;

  IF senior_id IS NULL THEN
    RAISE EXCEPTION 'senior not found';
  END IF;

  -- Rate-limit: max 5 attempts per 10 minutes per caregiver+senior
  SELECT count(*) >= 5 INTO too_many
  FROM public.caregiver_pin_attempts
  WHERE caregiver_user_id = caregiver
    AND senior_user_id = senior_id
    AND ts > now() - interval '10 minutes';
  IF too_many THEN
    RAISE EXCEPTION 'too many attempts, try later';
  END IF;

  SELECT pin_hash INTO hash FROM public.caregiver_pins WHERE senior_user_id = senior_id;
  IF hash IS NOT NULL AND p_pin ~ '^\d{4,8}$' AND crypt(p_pin, hash) = hash THEN
    ok := true;
  END IF;

  INSERT INTO public.caregiver_pin_attempts(caregiver_user_id, senior_user_id, success, client_ip)
  VALUES (caregiver, senior_id, ok, p_client_ip);

  IF ok THEN
    INSERT INTO public.caregiver_view_grants(caregiver_user_id, senior_user_id, expires_at)
    VALUES (caregiver, senior_id, now() + (p_ttl_minutes || ' minutes')::interval);
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.caregiver_verify_pin_grant(p_senior_identifier text, p_pin text, p_ttl_minutes integer DEFAULT 120, p_client_ip inet DEFAULT NULL::inet)
 RETURNS TABLE(senior_user_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  ok boolean;
BEGIN
  -- use existing verifier; it inserts a grant when ok=true
  ok := public.caregiver_verify_pin(p_senior_identifier, p_pin, p_ttl_minutes, p_client_ip);
  IF ok THEN
    RETURN QUERY
      SELECT g.senior_user_id, g.expires_at
      FROM public.caregiver_view_grants g
      WHERE g.caregiver_user_id = auth.uid()
        AND (g.senior_user_id = (
              SELECT id FROM auth.users
              WHERE id::text = p_senior_identifier
                 OR phone = p_senior_identifier
                 OR lower(email) = lower(p_senior_identifier)
              LIMIT 1
            ))
      ORDER BY g.id DESC
      LIMIT 1;
  ELSE
    RETURN; -- empty result
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_user_has_role(role_names text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  has_role BOOLEAN;
BEGIN
  -- Check using role_id since that's what you have
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.user_id = auth.uid() AND r.name = ANY(role_names)
  ) INTO has_role;
  RETURN COALESCE(has_role, false);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_has_any_role(_roles text[])
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.user_id = auth.uid()
      and r.name = any(_roles)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.disable_profile(_target uuid, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin_or_super_admin() then
    raise exception 'Admin only';
  end if;

  update public.profiles
  set disabled_at = now(),
      disabled_by = auth.uid(),
      disabled_reason = coalesce(_reason,'disabled')
  where user_id = _target;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enable_profile(_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin_or_super_admin() then
    raise exception 'Admin only';
  end if;

  update public.profiles
  set disabled_at = null,
      disabled_by = null,
      disabled_reason = null
  where user_id = _target;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_check_in_stats()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT public.get_user_check_in_stats(auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Insert into profiles table using user_id (not id!)
  INSERT INTO public.profiles (
    user_id,           -- Correct column name
    first_name,
    last_name,
    phone,
    role_id,
    onboarded,
    phone_verified,
    email_verified,
    consent
  )
  VALUES (
    NEW.id,           -- This is the auth.users.id (UUID)
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.phone,
    1,                -- Default role_id (you may need to adjust this)
    false,            -- Default onboarded = false
    COALESCE(NEW.phone_confirmed_at IS NOT NULL, false),
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    true              -- Default consent = true
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(uid uuid, role_name text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.user_id = uid
      AND r.name = role_name
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.is_admin(auth.uid()); $function$
;

CREATE OR REPLACE FUNCTION public.is_admin(u uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.has_role(u, 'admin'); $function$
;

CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_user_has_any_role(array['admin','super_admin']);
$function$
;

CREATE OR REPLACE FUNCTION public.is_adminish(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select (is_admin = true)
        or (lower(coalesce(role,'')) in ('admin','super_admin','staff','moderator'))
    from profiles where user_id = uid
  ), false);
$function$
;

CREATE OR REPLACE FUNCTION public.is_moderator()
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.is_moderator(auth.uid()); $function$
;

CREATE OR REPLACE FUNCTION public.is_moderator(u uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.has_role(u, 'moderator'); $function$
;

CREATE OR REPLACE FUNCTION public.is_service_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role', false)
      OR coalesce((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_admin')::boolean, false);
$function$
;

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    -- profiles path
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.user_id = auth.uid()
      and r.name in ('admin','super_admin','staff')

    union all

    -- user_roles path
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name in ('admin','super_admin','staff')
    limit 1
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.is_super_admin(auth.uid()); $function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin(u uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ SELECT public.has_role(u, 'super_admin'); $function$
;

CREATE OR REPLACE FUNCTION public.log_admin_notes_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op='INSERT' then
    insert into public.admin_notes_audit(note_id,action,new_row,acted_by)
    values(new.id,'INSERT',to_jsonb(new),auth.uid()); return new;
  elsif tg_op='UPDATE' then
    insert into public.admin_notes_audit(note_id,action,old_row,new_row,acted_by)
    values(new.id,'UPDATE',to_jsonb(old),to_jsonb(new),auth.uid()); return new;
  elsif tg_op='DELETE' then
    insert into public.admin_notes_audit(note_id,action,old_row,acted_by)
    values(old.id,'DELETE',to_jsonb(old),auth.uid()); return old;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_check_ins_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op='INSERT' then
    insert into public.check_ins_audit(check_in_id,action,new_row,acted_by)
    values(new.id,'INSERT',to_jsonb(new),auth.uid()); return new;
  elsif tg_op='UPDATE' then
    insert into public.check_ins_audit(check_in_id,action,old_row,new_row,acted_by)
    values(new.id,'UPDATE',to_jsonb(old),to_jsonb(new),auth.uid()); return new;
  elsif tg_op='DELETE' then
    insert into public.check_ins_audit(check_in_id,action,old_row,acted_by)
    values(old.id,'DELETE',to_jsonb(old),auth.uid()); return old;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_cm_feature_toggle()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'UPDATE') AND (OLD.is_gallery_high IS DISTINCT FROM NEW.is_gallery_high) THEN
    INSERT INTO public.admin_audit_log (actor_user_id, action, target_table, target_id, details)
    VALUES (
      auth.uid(),
      CASE WHEN NEW.is_gallery_high THEN 'feature' ELSE 'unfeature' END,
      'community_moments',
      NEW.id::text,
      jsonb_build_object(
        'from', OLD.is_gallery_high,
        'to', NEW.is_gallery_high
      )
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_cm_feature_toggle(p_event text, p_feature text, p_actor uuid, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- schema-qualify targets:
  INSERT INTO public.cm_feature_toggle_log(event, feature, actor, enabled, logged_at)
  VALUES (p_event, p_feature, p_actor, p_enabled, now());
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_user_roles_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.user_roles_audit (deleted_by, old_user_id, old_role_id)
  values (auth.uid(), old.user_id, old.role_id);
  return old;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.profiles_restrict_user_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- If the current user is an admin (role: admin or super admin), allow the update
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Otherwise, block edits (your old behavior was “password/email/address only”,
  -- but those typically live in auth.users; keep this strict for safety)
  RAISE EXCEPTION 'Only administrators may edit profiles. Contact admin for other edits.';
END
$function$
;

CREATE OR REPLACE FUNCTION public.purge_fcm_token(_token text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _rows int;
begin
  if not public.is_admin_or_super_admin() then
    raise exception 'Admin only';
  end if;

  delete from public.fcm_tokens where token = _token;
  get diagnostics _rows = row_count;
  return _rows;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.purge_stale_fcm_tokens(_days integer DEFAULT 90)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _rows int;
begin
  if not public.is_admin_or_super_admin() then
    raise exception 'Admin only';
  end if;

  delete from public.fcm_tokens
  where last_used_at < (now() - (_days||' days')::interval);

  get diagnostics _rows = row_count;
  return _rows;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.register_fcm_token(_token text, _device text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated';
  end if;

  insert into public.fcm_tokens (user_id, token, device_info)
  values (auth.uid(), _token, _device)
  on conflict (token) do update
    set user_id      = excluded.user_id,
        last_used_at = now(),
        device_info  = coalesce(excluded.device_info, public.fcm_tokens.device_info);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_caregiver_pin(p_pin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_pin !~ '^\d{4,8}$' THEN
    RAISE EXCEPTION 'PIN must be 4–8 digits';
  END IF;

  INSERT INTO public.caregiver_pins (senior_user_id, pin_hash, updated_at, updated_by)
  VALUES (uid, crypt(p_pin, gen_salt('bf')), now(), uid)
  ON CONFLICT (senior_user_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash,
        updated_at = now(),
        updated_by = uid;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.setup_founder_admin(founder_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  found_user_id UUID;
  admin_role_id INTEGER;
  result JSON;
BEGIN
  -- Get the user ID from auth.users by email
  SELECT id INTO found_user_id FROM auth.users WHERE email = founder_email;
  
  IF found_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Please sign up first with email: ' || founder_email || ', then run this function again'
    );
  END IF;
  
  -- Get super_admin role_id
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'super_admin';
  
  -- Check if profile exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = found_user_id) THEN
    -- Create profile
    INSERT INTO public.profiles (
      user_id,
      email,
      phone,
      first_name,
      last_name,
      role_id,
      email_verified,
      created_at
    ) VALUES (
      found_user_id,
      founder_email,
      '000-000-0000',
      'Admin',
      'Founder',
      admin_role_id,
      true,
      NOW()
    );
  ELSE
    -- Update existing profile to super_admin
    UPDATE public.profiles
    SET 
      role_id = admin_role_id,
      email_verified = true
    WHERE user_id = found_user_id;
  END IF;
  
  result := json_build_object(
    'success', true,
    'message', 'You are now a super admin!',
    'user_id', found_user_id,
    'email', founder_email,
    'role', 'super_admin'
  );
  
  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_user_roles_from_profiles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.user_roles(user_id, role_id)
  values (new.user_id, new.role_id)
  on conflict (user_id) do update
    set role_id = excluded.role_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.user_questions_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

create or replace view "public"."v_push_targets" as  SELECT p.user_id,
    p.first_name,
    p.last_name,
    p.city,
    p.state,
    p.zip_code,
    ft.token,
    ft.last_used_at,
    ft.device_info,
    r.name AS role
   FROM ((fcm_tokens ft
     JOIN profiles p ON ((p.user_id = ft.user_id)))
     JOIN roles r ON ((r.id = p.role_id)));


grant delete on table "public"."_trigger_log" to "anon";

grant insert on table "public"."_trigger_log" to "anon";

grant references on table "public"."_trigger_log" to "anon";

grant select on table "public"."_trigger_log" to "anon";

grant trigger on table "public"."_trigger_log" to "anon";

grant truncate on table "public"."_trigger_log" to "anon";

grant update on table "public"."_trigger_log" to "anon";

grant delete on table "public"."_trigger_log" to "authenticated";

grant insert on table "public"."_trigger_log" to "authenticated";

grant references on table "public"."_trigger_log" to "authenticated";

grant select on table "public"."_trigger_log" to "authenticated";

grant trigger on table "public"."_trigger_log" to "authenticated";

grant truncate on table "public"."_trigger_log" to "authenticated";

grant update on table "public"."_trigger_log" to "authenticated";

grant delete on table "public"."_trigger_log" to "service_role";

grant insert on table "public"."_trigger_log" to "service_role";

grant references on table "public"."_trigger_log" to "service_role";

grant select on table "public"."_trigger_log" to "service_role";

grant trigger on table "public"."_trigger_log" to "service_role";

grant truncate on table "public"."_trigger_log" to "service_role";

grant update on table "public"."_trigger_log" to "service_role";

grant delete on table "public"."admin_enroll_audit" to "anon";

grant insert on table "public"."admin_enroll_audit" to "anon";

grant references on table "public"."admin_enroll_audit" to "anon";

grant select on table "public"."admin_enroll_audit" to "anon";

grant trigger on table "public"."admin_enroll_audit" to "anon";

grant truncate on table "public"."admin_enroll_audit" to "anon";

grant update on table "public"."admin_enroll_audit" to "anon";

grant delete on table "public"."admin_enroll_audit" to "authenticated";

grant insert on table "public"."admin_enroll_audit" to "authenticated";

grant references on table "public"."admin_enroll_audit" to "authenticated";

grant select on table "public"."admin_enroll_audit" to "authenticated";

grant trigger on table "public"."admin_enroll_audit" to "authenticated";

grant truncate on table "public"."admin_enroll_audit" to "authenticated";

grant update on table "public"."admin_enroll_audit" to "authenticated";

grant delete on table "public"."admin_enroll_audit" to "service_role";

grant insert on table "public"."admin_enroll_audit" to "service_role";

grant references on table "public"."admin_enroll_audit" to "service_role";

grant select on table "public"."admin_enroll_audit" to "service_role";

grant trigger on table "public"."admin_enroll_audit" to "service_role";

grant truncate on table "public"."admin_enroll_audit" to "service_role";

grant update on table "public"."admin_enroll_audit" to "service_role";

grant delete on table "public"."admin_notes_audit" to "anon";

grant insert on table "public"."admin_notes_audit" to "anon";

grant references on table "public"."admin_notes_audit" to "anon";

grant select on table "public"."admin_notes_audit" to "anon";

grant trigger on table "public"."admin_notes_audit" to "anon";

grant truncate on table "public"."admin_notes_audit" to "anon";

grant update on table "public"."admin_notes_audit" to "anon";

grant delete on table "public"."admin_notes_audit" to "authenticated";

grant insert on table "public"."admin_notes_audit" to "authenticated";

grant references on table "public"."admin_notes_audit" to "authenticated";

grant select on table "public"."admin_notes_audit" to "authenticated";

grant trigger on table "public"."admin_notes_audit" to "authenticated";

grant truncate on table "public"."admin_notes_audit" to "authenticated";

grant update on table "public"."admin_notes_audit" to "authenticated";

grant delete on table "public"."admin_notes_audit" to "service_role";

grant insert on table "public"."admin_notes_audit" to "service_role";

grant references on table "public"."admin_notes_audit" to "service_role";

grant select on table "public"."admin_notes_audit" to "service_role";

grant trigger on table "public"."admin_notes_audit" to "service_role";

grant truncate on table "public"."admin_notes_audit" to "service_role";

grant update on table "public"."admin_notes_audit" to "service_role";

grant delete on table "public"."admin_pin_attempts_log" to "anon";

grant insert on table "public"."admin_pin_attempts_log" to "anon";

grant references on table "public"."admin_pin_attempts_log" to "anon";

grant select on table "public"."admin_pin_attempts_log" to "anon";

grant trigger on table "public"."admin_pin_attempts_log" to "anon";

grant truncate on table "public"."admin_pin_attempts_log" to "anon";

grant update on table "public"."admin_pin_attempts_log" to "anon";

grant delete on table "public"."admin_pin_attempts_log" to "authenticated";

grant insert on table "public"."admin_pin_attempts_log" to "authenticated";

grant references on table "public"."admin_pin_attempts_log" to "authenticated";

grant select on table "public"."admin_pin_attempts_log" to "authenticated";

grant trigger on table "public"."admin_pin_attempts_log" to "authenticated";

grant truncate on table "public"."admin_pin_attempts_log" to "authenticated";

grant update on table "public"."admin_pin_attempts_log" to "authenticated";

grant delete on table "public"."admin_pin_attempts_log" to "service_role";

grant insert on table "public"."admin_pin_attempts_log" to "service_role";

grant references on table "public"."admin_pin_attempts_log" to "service_role";

grant select on table "public"."admin_pin_attempts_log" to "service_role";

grant trigger on table "public"."admin_pin_attempts_log" to "service_role";

grant truncate on table "public"."admin_pin_attempts_log" to "service_role";

grant update on table "public"."admin_pin_attempts_log" to "service_role";

grant delete on table "public"."admin_user_questions" to "anon";

grant insert on table "public"."admin_user_questions" to "anon";

grant references on table "public"."admin_user_questions" to "anon";

grant select on table "public"."admin_user_questions" to "anon";

grant trigger on table "public"."admin_user_questions" to "anon";

grant truncate on table "public"."admin_user_questions" to "anon";

grant update on table "public"."admin_user_questions" to "anon";

grant delete on table "public"."admin_user_questions" to "authenticated";

grant insert on table "public"."admin_user_questions" to "authenticated";

grant references on table "public"."admin_user_questions" to "authenticated";

grant select on table "public"."admin_user_questions" to "authenticated";

grant trigger on table "public"."admin_user_questions" to "authenticated";

grant truncate on table "public"."admin_user_questions" to "authenticated";

grant update on table "public"."admin_user_questions" to "authenticated";

grant delete on table "public"."admin_user_questions" to "service_role";

grant insert on table "public"."admin_user_questions" to "service_role";

grant references on table "public"."admin_user_questions" to "service_role";

grant select on table "public"."admin_user_questions" to "service_role";

grant trigger on table "public"."admin_user_questions" to "service_role";

grant truncate on table "public"."admin_user_questions" to "service_role";

grant update on table "public"."admin_user_questions" to "service_role";

grant select on table "public"."admin_users" to "authenticated";

grant delete on table "public"."admin_users" to "service_role";

grant insert on table "public"."admin_users" to "service_role";

grant references on table "public"."admin_users" to "service_role";

grant select on table "public"."admin_users" to "service_role";

grant trigger on table "public"."admin_users" to "service_role";

grant truncate on table "public"."admin_users" to "service_role";

grant update on table "public"."admin_users" to "service_role";

grant delete on table "public"."alerts" to "anon";

grant insert on table "public"."alerts" to "anon";

grant references on table "public"."alerts" to "anon";

grant select on table "public"."alerts" to "anon";

grant trigger on table "public"."alerts" to "anon";

grant truncate on table "public"."alerts" to "anon";

grant update on table "public"."alerts" to "anon";

grant delete on table "public"."alerts" to "authenticated";

grant insert on table "public"."alerts" to "authenticated";

grant references on table "public"."alerts" to "authenticated";

grant select on table "public"."alerts" to "authenticated";

grant trigger on table "public"."alerts" to "authenticated";

grant truncate on table "public"."alerts" to "authenticated";

grant update on table "public"."alerts" to "authenticated";

grant delete on table "public"."alerts" to "service_role";

grant insert on table "public"."alerts" to "service_role";

grant references on table "public"."alerts" to "service_role";

grant select on table "public"."alerts" to "service_role";

grant trigger on table "public"."alerts" to "service_role";

grant truncate on table "public"."alerts" to "service_role";

grant update on table "public"."alerts" to "service_role";

grant delete on table "public"."api_keys" to "anon";

grant insert on table "public"."api_keys" to "anon";

grant references on table "public"."api_keys" to "anon";

grant select on table "public"."api_keys" to "anon";

grant trigger on table "public"."api_keys" to "anon";

grant truncate on table "public"."api_keys" to "anon";

grant update on table "public"."api_keys" to "anon";

grant delete on table "public"."api_keys" to "authenticated";

grant insert on table "public"."api_keys" to "authenticated";

grant references on table "public"."api_keys" to "authenticated";

grant select on table "public"."api_keys" to "authenticated";

grant trigger on table "public"."api_keys" to "authenticated";

grant truncate on table "public"."api_keys" to "authenticated";

grant update on table "public"."api_keys" to "authenticated";

grant delete on table "public"."api_keys" to "service_role";

grant insert on table "public"."api_keys" to "service_role";

grant references on table "public"."api_keys" to "service_role";

grant select on table "public"."api_keys" to "service_role";

grant trigger on table "public"."api_keys" to "service_role";

grant truncate on table "public"."api_keys" to "service_role";

grant update on table "public"."api_keys" to "service_role";

grant delete on table "public"."caregiver_pin_attempts" to "anon";

grant insert on table "public"."caregiver_pin_attempts" to "anon";

grant references on table "public"."caregiver_pin_attempts" to "anon";

grant select on table "public"."caregiver_pin_attempts" to "anon";

grant trigger on table "public"."caregiver_pin_attempts" to "anon";

grant truncate on table "public"."caregiver_pin_attempts" to "anon";

grant update on table "public"."caregiver_pin_attempts" to "anon";

grant delete on table "public"."caregiver_pin_attempts" to "authenticated";

grant insert on table "public"."caregiver_pin_attempts" to "authenticated";

grant references on table "public"."caregiver_pin_attempts" to "authenticated";

grant select on table "public"."caregiver_pin_attempts" to "authenticated";

grant trigger on table "public"."caregiver_pin_attempts" to "authenticated";

grant truncate on table "public"."caregiver_pin_attempts" to "authenticated";

grant update on table "public"."caregiver_pin_attempts" to "authenticated";

grant delete on table "public"."caregiver_pin_attempts" to "service_role";

grant insert on table "public"."caregiver_pin_attempts" to "service_role";

grant references on table "public"."caregiver_pin_attempts" to "service_role";

grant select on table "public"."caregiver_pin_attempts" to "service_role";

grant trigger on table "public"."caregiver_pin_attempts" to "service_role";

grant truncate on table "public"."caregiver_pin_attempts" to "service_role";

grant update on table "public"."caregiver_pin_attempts" to "service_role";

grant delete on table "public"."caregiver_pins" to "anon";

grant insert on table "public"."caregiver_pins" to "anon";

grant references on table "public"."caregiver_pins" to "anon";

grant select on table "public"."caregiver_pins" to "anon";

grant trigger on table "public"."caregiver_pins" to "anon";

grant truncate on table "public"."caregiver_pins" to "anon";

grant update on table "public"."caregiver_pins" to "anon";

grant delete on table "public"."caregiver_pins" to "authenticated";

grant insert on table "public"."caregiver_pins" to "authenticated";

grant references on table "public"."caregiver_pins" to "authenticated";

grant select on table "public"."caregiver_pins" to "authenticated";

grant trigger on table "public"."caregiver_pins" to "authenticated";

grant truncate on table "public"."caregiver_pins" to "authenticated";

grant update on table "public"."caregiver_pins" to "authenticated";

grant delete on table "public"."caregiver_pins" to "service_role";

grant insert on table "public"."caregiver_pins" to "service_role";

grant references on table "public"."caregiver_pins" to "service_role";

grant select on table "public"."caregiver_pins" to "service_role";

grant trigger on table "public"."caregiver_pins" to "service_role";

grant truncate on table "public"."caregiver_pins" to "service_role";

grant update on table "public"."caregiver_pins" to "service_role";

grant delete on table "public"."caregiver_view_grants" to "anon";

grant insert on table "public"."caregiver_view_grants" to "anon";

grant references on table "public"."caregiver_view_grants" to "anon";

grant select on table "public"."caregiver_view_grants" to "anon";

grant trigger on table "public"."caregiver_view_grants" to "anon";

grant truncate on table "public"."caregiver_view_grants" to "anon";

grant update on table "public"."caregiver_view_grants" to "anon";

grant delete on table "public"."caregiver_view_grants" to "authenticated";

grant insert on table "public"."caregiver_view_grants" to "authenticated";

grant references on table "public"."caregiver_view_grants" to "authenticated";

grant select on table "public"."caregiver_view_grants" to "authenticated";

grant trigger on table "public"."caregiver_view_grants" to "authenticated";

grant truncate on table "public"."caregiver_view_grants" to "authenticated";

grant update on table "public"."caregiver_view_grants" to "authenticated";

grant delete on table "public"."caregiver_view_grants" to "service_role";

grant insert on table "public"."caregiver_view_grants" to "service_role";

grant references on table "public"."caregiver_view_grants" to "service_role";

grant select on table "public"."caregiver_view_grants" to "service_role";

grant trigger on table "public"."caregiver_view_grants" to "service_role";

grant truncate on table "public"."caregiver_view_grants" to "service_role";

grant update on table "public"."caregiver_view_grants" to "service_role";

grant delete on table "public"."check_ins_audit" to "anon";

grant insert on table "public"."check_ins_audit" to "anon";

grant references on table "public"."check_ins_audit" to "anon";

grant select on table "public"."check_ins_audit" to "anon";

grant trigger on table "public"."check_ins_audit" to "anon";

grant truncate on table "public"."check_ins_audit" to "anon";

grant update on table "public"."check_ins_audit" to "anon";

grant delete on table "public"."check_ins_audit" to "authenticated";

grant insert on table "public"."check_ins_audit" to "authenticated";

grant references on table "public"."check_ins_audit" to "authenticated";

grant select on table "public"."check_ins_audit" to "authenticated";

grant trigger on table "public"."check_ins_audit" to "authenticated";

grant truncate on table "public"."check_ins_audit" to "authenticated";

grant update on table "public"."check_ins_audit" to "authenticated";

grant delete on table "public"."check_ins_audit" to "service_role";

grant insert on table "public"."check_ins_audit" to "service_role";

grant references on table "public"."check_ins_audit" to "service_role";

grant select on table "public"."check_ins_audit" to "service_role";

grant trigger on table "public"."check_ins_audit" to "service_role";

grant truncate on table "public"."check_ins_audit" to "service_role";

grant update on table "public"."check_ins_audit" to "service_role";

grant delete on table "public"."comment_reports" to "anon";

grant insert on table "public"."comment_reports" to "anon";

grant references on table "public"."comment_reports" to "anon";

grant select on table "public"."comment_reports" to "anon";

grant trigger on table "public"."comment_reports" to "anon";

grant truncate on table "public"."comment_reports" to "anon";

grant update on table "public"."comment_reports" to "anon";

grant delete on table "public"."comment_reports" to "authenticated";

grant insert on table "public"."comment_reports" to "authenticated";

grant references on table "public"."comment_reports" to "authenticated";

grant select on table "public"."comment_reports" to "authenticated";

grant trigger on table "public"."comment_reports" to "authenticated";

grant truncate on table "public"."comment_reports" to "authenticated";

grant update on table "public"."comment_reports" to "authenticated";

grant delete on table "public"."comment_reports" to "service_role";

grant insert on table "public"."comment_reports" to "service_role";

grant references on table "public"."comment_reports" to "service_role";

grant select on table "public"."comment_reports" to "service_role";

grant trigger on table "public"."comment_reports" to "service_role";

grant truncate on table "public"."comment_reports" to "service_role";

grant update on table "public"."comment_reports" to "service_role";

grant delete on table "public"."comments" to "anon";

grant insert on table "public"."comments" to "anon";

grant references on table "public"."comments" to "anon";

grant select on table "public"."comments" to "anon";

grant trigger on table "public"."comments" to "anon";

grant truncate on table "public"."comments" to "anon";

grant update on table "public"."comments" to "anon";

grant delete on table "public"."comments" to "authenticated";

grant insert on table "public"."comments" to "authenticated";

grant references on table "public"."comments" to "authenticated";

grant select on table "public"."comments" to "authenticated";

grant trigger on table "public"."comments" to "authenticated";

grant truncate on table "public"."comments" to "authenticated";

grant update on table "public"."comments" to "authenticated";

grant delete on table "public"."comments" to "service_role";

grant insert on table "public"."comments" to "service_role";

grant references on table "public"."comments" to "service_role";

grant select on table "public"."comments" to "service_role";

grant trigger on table "public"."comments" to "service_role";

grant truncate on table "public"."comments" to "service_role";

grant update on table "public"."comments" to "service_role";

grant delete on table "public"."consent_log" to "anon";

grant insert on table "public"."consent_log" to "anon";

grant references on table "public"."consent_log" to "anon";

grant select on table "public"."consent_log" to "anon";

grant trigger on table "public"."consent_log" to "anon";

grant truncate on table "public"."consent_log" to "anon";

grant update on table "public"."consent_log" to "anon";

grant delete on table "public"."consent_log" to "authenticated";

grant insert on table "public"."consent_log" to "authenticated";

grant references on table "public"."consent_log" to "authenticated";

grant select on table "public"."consent_log" to "authenticated";

grant trigger on table "public"."consent_log" to "authenticated";

grant truncate on table "public"."consent_log" to "authenticated";

grant update on table "public"."consent_log" to "authenticated";

grant delete on table "public"."consent_log" to "service_role";

grant insert on table "public"."consent_log" to "service_role";

grant references on table "public"."consent_log" to "service_role";

grant select on table "public"."consent_log" to "service_role";

grant trigger on table "public"."consent_log" to "service_role";

grant truncate on table "public"."consent_log" to "service_role";

grant update on table "public"."consent_log" to "service_role";

grant delete on table "public"."fcm_tokens" to "anon";

grant insert on table "public"."fcm_tokens" to "anon";

grant references on table "public"."fcm_tokens" to "anon";

grant select on table "public"."fcm_tokens" to "anon";

grant trigger on table "public"."fcm_tokens" to "anon";

grant truncate on table "public"."fcm_tokens" to "anon";

grant update on table "public"."fcm_tokens" to "anon";

grant delete on table "public"."fcm_tokens" to "authenticated";

grant insert on table "public"."fcm_tokens" to "authenticated";

grant references on table "public"."fcm_tokens" to "authenticated";

grant select on table "public"."fcm_tokens" to "authenticated";

grant trigger on table "public"."fcm_tokens" to "authenticated";

grant truncate on table "public"."fcm_tokens" to "authenticated";

grant update on table "public"."fcm_tokens" to "authenticated";

grant delete on table "public"."fcm_tokens" to "service_role";

grant insert on table "public"."fcm_tokens" to "service_role";

grant references on table "public"."fcm_tokens" to "service_role";

grant select on table "public"."fcm_tokens" to "service_role";

grant trigger on table "public"."fcm_tokens" to "service_role";

grant truncate on table "public"."fcm_tokens" to "service_role";

grant update on table "public"."fcm_tokens" to "service_role";

grant delete on table "public"."geofence_events" to "anon";

grant insert on table "public"."geofence_events" to "anon";

grant references on table "public"."geofence_events" to "anon";

grant select on table "public"."geofence_events" to "anon";

grant trigger on table "public"."geofence_events" to "anon";

grant truncate on table "public"."geofence_events" to "anon";

grant update on table "public"."geofence_events" to "anon";

grant delete on table "public"."geofence_events" to "authenticated";

grant insert on table "public"."geofence_events" to "authenticated";

grant references on table "public"."geofence_events" to "authenticated";

grant select on table "public"."geofence_events" to "authenticated";

grant trigger on table "public"."geofence_events" to "authenticated";

grant truncate on table "public"."geofence_events" to "authenticated";

grant update on table "public"."geofence_events" to "authenticated";

grant delete on table "public"."geofence_events" to "service_role";

grant insert on table "public"."geofence_events" to "service_role";

grant references on table "public"."geofence_events" to "service_role";

grant select on table "public"."geofence_events" to "service_role";

grant trigger on table "public"."geofence_events" to "service_role";

grant truncate on table "public"."geofence_events" to "service_role";

grant update on table "public"."geofence_events" to "service_role";

grant delete on table "public"."geofence_zones" to "anon";

grant insert on table "public"."geofence_zones" to "anon";

grant references on table "public"."geofence_zones" to "anon";

grant select on table "public"."geofence_zones" to "anon";

grant trigger on table "public"."geofence_zones" to "anon";

grant truncate on table "public"."geofence_zones" to "anon";

grant update on table "public"."geofence_zones" to "anon";

grant delete on table "public"."geofence_zones" to "authenticated";

grant insert on table "public"."geofence_zones" to "authenticated";

grant references on table "public"."geofence_zones" to "authenticated";

grant select on table "public"."geofence_zones" to "authenticated";

grant trigger on table "public"."geofence_zones" to "authenticated";

grant truncate on table "public"."geofence_zones" to "authenticated";

grant update on table "public"."geofence_zones" to "authenticated";

grant delete on table "public"."geofence_zones" to "service_role";

grant insert on table "public"."geofence_zones" to "service_role";

grant references on table "public"."geofence_zones" to "service_role";

grant select on table "public"."geofence_zones" to "service_role";

grant trigger on table "public"."geofence_zones" to "service_role";

grant truncate on table "public"."geofence_zones" to "service_role";

grant update on table "public"."geofence_zones" to "service_role";

grant delete on table "public"."mobile_devices" to "anon";

grant insert on table "public"."mobile_devices" to "anon";

grant references on table "public"."mobile_devices" to "anon";

grant select on table "public"."mobile_devices" to "anon";

grant trigger on table "public"."mobile_devices" to "anon";

grant truncate on table "public"."mobile_devices" to "anon";

grant update on table "public"."mobile_devices" to "anon";

grant delete on table "public"."mobile_devices" to "authenticated";

grant insert on table "public"."mobile_devices" to "authenticated";

grant references on table "public"."mobile_devices" to "authenticated";

grant select on table "public"."mobile_devices" to "authenticated";

grant trigger on table "public"."mobile_devices" to "authenticated";

grant truncate on table "public"."mobile_devices" to "authenticated";

grant update on table "public"."mobile_devices" to "authenticated";

grant delete on table "public"."mobile_devices" to "service_role";

grant insert on table "public"."mobile_devices" to "service_role";

grant references on table "public"."mobile_devices" to "service_role";

grant select on table "public"."mobile_devices" to "service_role";

grant trigger on table "public"."mobile_devices" to "service_role";

grant truncate on table "public"."mobile_devices" to "service_role";

grant update on table "public"."mobile_devices" to "service_role";

grant delete on table "public"."mobile_emergency_contacts" to "anon";

grant insert on table "public"."mobile_emergency_contacts" to "anon";

grant references on table "public"."mobile_emergency_contacts" to "anon";

grant select on table "public"."mobile_emergency_contacts" to "anon";

grant trigger on table "public"."mobile_emergency_contacts" to "anon";

grant truncate on table "public"."mobile_emergency_contacts" to "anon";

grant update on table "public"."mobile_emergency_contacts" to "anon";

grant delete on table "public"."mobile_emergency_contacts" to "authenticated";

grant insert on table "public"."mobile_emergency_contacts" to "authenticated";

grant references on table "public"."mobile_emergency_contacts" to "authenticated";

grant select on table "public"."mobile_emergency_contacts" to "authenticated";

grant trigger on table "public"."mobile_emergency_contacts" to "authenticated";

grant truncate on table "public"."mobile_emergency_contacts" to "authenticated";

grant update on table "public"."mobile_emergency_contacts" to "authenticated";

grant delete on table "public"."mobile_emergency_contacts" to "service_role";

grant insert on table "public"."mobile_emergency_contacts" to "service_role";

grant references on table "public"."mobile_emergency_contacts" to "service_role";

grant select on table "public"."mobile_emergency_contacts" to "service_role";

grant trigger on table "public"."mobile_emergency_contacts" to "service_role";

grant truncate on table "public"."mobile_emergency_contacts" to "service_role";

grant update on table "public"."mobile_emergency_contacts" to "service_role";

grant delete on table "public"."mobile_emergency_incidents" to "anon";

grant insert on table "public"."mobile_emergency_incidents" to "anon";

grant references on table "public"."mobile_emergency_incidents" to "anon";

grant select on table "public"."mobile_emergency_incidents" to "anon";

grant trigger on table "public"."mobile_emergency_incidents" to "anon";

grant truncate on table "public"."mobile_emergency_incidents" to "anon";

grant update on table "public"."mobile_emergency_incidents" to "anon";

grant delete on table "public"."mobile_emergency_incidents" to "authenticated";

grant insert on table "public"."mobile_emergency_incidents" to "authenticated";

grant references on table "public"."mobile_emergency_incidents" to "authenticated";

grant select on table "public"."mobile_emergency_incidents" to "authenticated";

grant trigger on table "public"."mobile_emergency_incidents" to "authenticated";

grant truncate on table "public"."mobile_emergency_incidents" to "authenticated";

grant update on table "public"."mobile_emergency_incidents" to "authenticated";

grant delete on table "public"."mobile_emergency_incidents" to "service_role";

grant insert on table "public"."mobile_emergency_incidents" to "service_role";

grant references on table "public"."mobile_emergency_incidents" to "service_role";

grant select on table "public"."mobile_emergency_incidents" to "service_role";

grant trigger on table "public"."mobile_emergency_incidents" to "service_role";

grant truncate on table "public"."mobile_emergency_incidents" to "service_role";

grant update on table "public"."mobile_emergency_incidents" to "service_role";

grant delete on table "public"."mobile_sync_status" to "anon";

grant insert on table "public"."mobile_sync_status" to "anon";

grant references on table "public"."mobile_sync_status" to "anon";

grant select on table "public"."mobile_sync_status" to "anon";

grant trigger on table "public"."mobile_sync_status" to "anon";

grant truncate on table "public"."mobile_sync_status" to "anon";

grant update on table "public"."mobile_sync_status" to "anon";

grant delete on table "public"."mobile_sync_status" to "authenticated";

grant insert on table "public"."mobile_sync_status" to "authenticated";

grant references on table "public"."mobile_sync_status" to "authenticated";

grant select on table "public"."mobile_sync_status" to "authenticated";

grant trigger on table "public"."mobile_sync_status" to "authenticated";

grant truncate on table "public"."mobile_sync_status" to "authenticated";

grant update on table "public"."mobile_sync_status" to "authenticated";

grant delete on table "public"."mobile_sync_status" to "service_role";

grant insert on table "public"."mobile_sync_status" to "service_role";

grant references on table "public"."mobile_sync_status" to "service_role";

grant select on table "public"."mobile_sync_status" to "service_role";

grant trigger on table "public"."mobile_sync_status" to "service_role";

grant truncate on table "public"."mobile_sync_status" to "service_role";

grant update on table "public"."mobile_sync_status" to "service_role";

grant delete on table "public"."mobile_vitals" to "anon";

grant insert on table "public"."mobile_vitals" to "anon";

grant references on table "public"."mobile_vitals" to "anon";

grant select on table "public"."mobile_vitals" to "anon";

grant trigger on table "public"."mobile_vitals" to "anon";

grant truncate on table "public"."mobile_vitals" to "anon";

grant update on table "public"."mobile_vitals" to "anon";

grant delete on table "public"."mobile_vitals" to "authenticated";

grant insert on table "public"."mobile_vitals" to "authenticated";

grant references on table "public"."mobile_vitals" to "authenticated";

grant select on table "public"."mobile_vitals" to "authenticated";

grant trigger on table "public"."mobile_vitals" to "authenticated";

grant truncate on table "public"."mobile_vitals" to "authenticated";

grant update on table "public"."mobile_vitals" to "authenticated";

grant delete on table "public"."mobile_vitals" to "service_role";

grant insert on table "public"."mobile_vitals" to "service_role";

grant references on table "public"."mobile_vitals" to "service_role";

grant select on table "public"."mobile_vitals" to "service_role";

grant trigger on table "public"."mobile_vitals" to "service_role";

grant truncate on table "public"."mobile_vitals" to "service_role";

grant update on table "public"."mobile_vitals" to "service_role";

grant delete on table "public"."movement_patterns" to "anon";

grant insert on table "public"."movement_patterns" to "anon";

grant references on table "public"."movement_patterns" to "anon";

grant select on table "public"."movement_patterns" to "anon";

grant trigger on table "public"."movement_patterns" to "anon";

grant truncate on table "public"."movement_patterns" to "anon";

grant update on table "public"."movement_patterns" to "anon";

grant delete on table "public"."movement_patterns" to "authenticated";

grant insert on table "public"."movement_patterns" to "authenticated";

grant references on table "public"."movement_patterns" to "authenticated";

grant select on table "public"."movement_patterns" to "authenticated";

grant trigger on table "public"."movement_patterns" to "authenticated";

grant truncate on table "public"."movement_patterns" to "authenticated";

grant update on table "public"."movement_patterns" to "authenticated";

grant delete on table "public"."movement_patterns" to "service_role";

grant insert on table "public"."movement_patterns" to "service_role";

grant references on table "public"."movement_patterns" to "service_role";

grant select on table "public"."movement_patterns" to "service_role";

grant trigger on table "public"."movement_patterns" to "service_role";

grant truncate on table "public"."movement_patterns" to "service_role";

grant update on table "public"."movement_patterns" to "service_role";

grant delete on table "public"."patient_locations" to "anon";

grant insert on table "public"."patient_locations" to "anon";

grant references on table "public"."patient_locations" to "anon";

grant select on table "public"."patient_locations" to "anon";

grant trigger on table "public"."patient_locations" to "anon";

grant truncate on table "public"."patient_locations" to "anon";

grant update on table "public"."patient_locations" to "anon";

grant delete on table "public"."patient_locations" to "authenticated";

grant insert on table "public"."patient_locations" to "authenticated";

grant references on table "public"."patient_locations" to "authenticated";

grant select on table "public"."patient_locations" to "authenticated";

grant trigger on table "public"."patient_locations" to "authenticated";

grant truncate on table "public"."patient_locations" to "authenticated";

grant update on table "public"."patient_locations" to "authenticated";

grant delete on table "public"."patient_locations" to "service_role";

grant insert on table "public"."patient_locations" to "service_role";

grant references on table "public"."patient_locations" to "service_role";

grant select on table "public"."patient_locations" to "service_role";

grant trigger on table "public"."patient_locations" to "service_role";

grant truncate on table "public"."patient_locations" to "service_role";

grant update on table "public"."patient_locations" to "service_role";

grant delete on table "public"."push_subscriptions" to "anon";

grant insert on table "public"."push_subscriptions" to "anon";

grant references on table "public"."push_subscriptions" to "anon";

grant select on table "public"."push_subscriptions" to "anon";

grant trigger on table "public"."push_subscriptions" to "anon";

grant truncate on table "public"."push_subscriptions" to "anon";

grant update on table "public"."push_subscriptions" to "anon";

grant delete on table "public"."push_subscriptions" to "authenticated";

grant insert on table "public"."push_subscriptions" to "authenticated";

grant references on table "public"."push_subscriptions" to "authenticated";

grant select on table "public"."push_subscriptions" to "authenticated";

grant trigger on table "public"."push_subscriptions" to "authenticated";

grant truncate on table "public"."push_subscriptions" to "authenticated";

grant update on table "public"."push_subscriptions" to "authenticated";

grant delete on table "public"."push_subscriptions" to "service_role";

grant insert on table "public"."push_subscriptions" to "service_role";

grant references on table "public"."push_subscriptions" to "service_role";

grant select on table "public"."push_subscriptions" to "service_role";

grant trigger on table "public"."push_subscriptions" to "service_role";

grant truncate on table "public"."push_subscriptions" to "service_role";

grant update on table "public"."push_subscriptions" to "service_role";

grant delete on table "public"."rate_limit_admin" to "anon";

grant insert on table "public"."rate_limit_admin" to "anon";

grant references on table "public"."rate_limit_admin" to "anon";

grant select on table "public"."rate_limit_admin" to "anon";

grant trigger on table "public"."rate_limit_admin" to "anon";

grant truncate on table "public"."rate_limit_admin" to "anon";

grant update on table "public"."rate_limit_admin" to "anon";

grant delete on table "public"."rate_limit_admin" to "authenticated";

grant insert on table "public"."rate_limit_admin" to "authenticated";

grant references on table "public"."rate_limit_admin" to "authenticated";

grant select on table "public"."rate_limit_admin" to "authenticated";

grant trigger on table "public"."rate_limit_admin" to "authenticated";

grant truncate on table "public"."rate_limit_admin" to "authenticated";

grant update on table "public"."rate_limit_admin" to "authenticated";

grant delete on table "public"."rate_limit_admin" to "service_role";

grant insert on table "public"."rate_limit_admin" to "service_role";

grant references on table "public"."rate_limit_admin" to "service_role";

grant select on table "public"."rate_limit_admin" to "service_role";

grant trigger on table "public"."rate_limit_admin" to "service_role";

grant truncate on table "public"."rate_limit_admin" to "service_role";

grant update on table "public"."rate_limit_admin" to "service_role";

grant delete on table "public"."rate_limit_logins" to "anon";

grant insert on table "public"."rate_limit_logins" to "anon";

grant references on table "public"."rate_limit_logins" to "anon";

grant select on table "public"."rate_limit_logins" to "anon";

grant trigger on table "public"."rate_limit_logins" to "anon";

grant truncate on table "public"."rate_limit_logins" to "anon";

grant update on table "public"."rate_limit_logins" to "anon";

grant delete on table "public"."rate_limit_logins" to "authenticated";

grant insert on table "public"."rate_limit_logins" to "authenticated";

grant references on table "public"."rate_limit_logins" to "authenticated";

grant select on table "public"."rate_limit_logins" to "authenticated";

grant trigger on table "public"."rate_limit_logins" to "authenticated";

grant truncate on table "public"."rate_limit_logins" to "authenticated";

grant update on table "public"."rate_limit_logins" to "authenticated";

grant delete on table "public"."rate_limit_logins" to "service_role";

grant insert on table "public"."rate_limit_logins" to "service_role";

grant references on table "public"."rate_limit_logins" to "service_role";

grant select on table "public"."rate_limit_logins" to "service_role";

grant trigger on table "public"."rate_limit_logins" to "service_role";

grant truncate on table "public"."rate_limit_logins" to "service_role";

grant update on table "public"."rate_limit_logins" to "service_role";

grant delete on table "public"."rate_limit_registrations" to "anon";

grant insert on table "public"."rate_limit_registrations" to "anon";

grant references on table "public"."rate_limit_registrations" to "anon";

grant select on table "public"."rate_limit_registrations" to "anon";

grant trigger on table "public"."rate_limit_registrations" to "anon";

grant truncate on table "public"."rate_limit_registrations" to "anon";

grant update on table "public"."rate_limit_registrations" to "anon";

grant delete on table "public"."rate_limit_registrations" to "authenticated";

grant insert on table "public"."rate_limit_registrations" to "authenticated";

grant references on table "public"."rate_limit_registrations" to "authenticated";

grant select on table "public"."rate_limit_registrations" to "authenticated";

grant trigger on table "public"."rate_limit_registrations" to "authenticated";

grant truncate on table "public"."rate_limit_registrations" to "authenticated";

grant update on table "public"."rate_limit_registrations" to "authenticated";

grant delete on table "public"."rate_limit_registrations" to "service_role";

grant insert on table "public"."rate_limit_registrations" to "service_role";

grant references on table "public"."rate_limit_registrations" to "service_role";

grant select on table "public"."rate_limit_registrations" to "service_role";

grant trigger on table "public"."rate_limit_registrations" to "service_role";

grant truncate on table "public"."rate_limit_registrations" to "service_role";

grant update on table "public"."rate_limit_registrations" to "service_role";

grant delete on table "public"."roles" to "anon";

grant insert on table "public"."roles" to "anon";

grant references on table "public"."roles" to "anon";

grant select on table "public"."roles" to "anon";

grant trigger on table "public"."roles" to "anon";

grant truncate on table "public"."roles" to "anon";

grant update on table "public"."roles" to "anon";

grant delete on table "public"."roles" to "authenticated";

grant insert on table "public"."roles" to "authenticated";

grant references on table "public"."roles" to "authenticated";

grant select on table "public"."roles" to "authenticated";

grant trigger on table "public"."roles" to "authenticated";

grant truncate on table "public"."roles" to "authenticated";

grant update on table "public"."roles" to "authenticated";

grant delete on table "public"."roles" to "service_role";

grant insert on table "public"."roles" to "service_role";

grant references on table "public"."roles" to "service_role";

grant select on table "public"."roles" to "service_role";

grant trigger on table "public"."roles" to "service_role";

grant truncate on table "public"."roles" to "service_role";

grant update on table "public"."roles" to "service_role";

grant delete on table "public"."self_reports" to "anon";

grant insert on table "public"."self_reports" to "anon";

grant references on table "public"."self_reports" to "anon";

grant select on table "public"."self_reports" to "anon";

grant trigger on table "public"."self_reports" to "anon";

grant truncate on table "public"."self_reports" to "anon";

grant update on table "public"."self_reports" to "anon";

grant delete on table "public"."self_reports" to "authenticated";

grant insert on table "public"."self_reports" to "authenticated";

grant references on table "public"."self_reports" to "authenticated";

grant select on table "public"."self_reports" to "authenticated";

grant trigger on table "public"."self_reports" to "authenticated";

grant truncate on table "public"."self_reports" to "authenticated";

grant update on table "public"."self_reports" to "authenticated";

grant delete on table "public"."self_reports" to "service_role";

grant insert on table "public"."self_reports" to "service_role";

grant references on table "public"."self_reports" to "service_role";

grant select on table "public"."self_reports" to "service_role";

grant trigger on table "public"."self_reports" to "service_role";

grant truncate on table "public"."self_reports" to "service_role";

grant update on table "public"."self_reports" to "service_role";

grant delete on table "public"."senior_demographics" to "anon";

grant insert on table "public"."senior_demographics" to "anon";

grant references on table "public"."senior_demographics" to "anon";

grant select on table "public"."senior_demographics" to "anon";

grant trigger on table "public"."senior_demographics" to "anon";

grant truncate on table "public"."senior_demographics" to "anon";

grant update on table "public"."senior_demographics" to "anon";

grant delete on table "public"."senior_demographics" to "authenticated";

grant insert on table "public"."senior_demographics" to "authenticated";

grant references on table "public"."senior_demographics" to "authenticated";

grant select on table "public"."senior_demographics" to "authenticated";

grant trigger on table "public"."senior_demographics" to "authenticated";

grant truncate on table "public"."senior_demographics" to "authenticated";

grant update on table "public"."senior_demographics" to "authenticated";

grant delete on table "public"."senior_demographics" to "service_role";

grant insert on table "public"."senior_demographics" to "service_role";

grant references on table "public"."senior_demographics" to "service_role";

grant select on table "public"."senior_demographics" to "service_role";

grant trigger on table "public"."senior_demographics" to "service_role";

grant truncate on table "public"."senior_demographics" to "service_role";

grant update on table "public"."senior_demographics" to "service_role";

grant delete on table "public"."senior_emergency_contacts" to "anon";

grant insert on table "public"."senior_emergency_contacts" to "anon";

grant references on table "public"."senior_emergency_contacts" to "anon";

grant select on table "public"."senior_emergency_contacts" to "anon";

grant trigger on table "public"."senior_emergency_contacts" to "anon";

grant truncate on table "public"."senior_emergency_contacts" to "anon";

grant update on table "public"."senior_emergency_contacts" to "anon";

grant delete on table "public"."senior_emergency_contacts" to "authenticated";

grant insert on table "public"."senior_emergency_contacts" to "authenticated";

grant references on table "public"."senior_emergency_contacts" to "authenticated";

grant select on table "public"."senior_emergency_contacts" to "authenticated";

grant trigger on table "public"."senior_emergency_contacts" to "authenticated";

grant truncate on table "public"."senior_emergency_contacts" to "authenticated";

grant update on table "public"."senior_emergency_contacts" to "authenticated";

grant delete on table "public"."senior_emergency_contacts" to "service_role";

grant insert on table "public"."senior_emergency_contacts" to "service_role";

grant references on table "public"."senior_emergency_contacts" to "service_role";

grant select on table "public"."senior_emergency_contacts" to "service_role";

grant trigger on table "public"."senior_emergency_contacts" to "service_role";

grant truncate on table "public"."senior_emergency_contacts" to "service_role";

grant update on table "public"."senior_emergency_contacts" to "service_role";

grant delete on table "public"."senior_health" to "anon";

grant insert on table "public"."senior_health" to "anon";

grant references on table "public"."senior_health" to "anon";

grant select on table "public"."senior_health" to "anon";

grant trigger on table "public"."senior_health" to "anon";

grant truncate on table "public"."senior_health" to "anon";

grant update on table "public"."senior_health" to "anon";

grant delete on table "public"."senior_health" to "authenticated";

grant insert on table "public"."senior_health" to "authenticated";

grant references on table "public"."senior_health" to "authenticated";

grant select on table "public"."senior_health" to "authenticated";

grant trigger on table "public"."senior_health" to "authenticated";

grant truncate on table "public"."senior_health" to "authenticated";

grant update on table "public"."senior_health" to "authenticated";

grant delete on table "public"."senior_health" to "service_role";

grant insert on table "public"."senior_health" to "service_role";

grant references on table "public"."senior_health" to "service_role";

grant select on table "public"."senior_health" to "service_role";

grant trigger on table "public"."senior_health" to "service_role";

grant truncate on table "public"."senior_health" to "service_role";

grant update on table "public"."senior_health" to "service_role";

grant delete on table "public"."senior_sdoh" to "anon";

grant insert on table "public"."senior_sdoh" to "anon";

grant references on table "public"."senior_sdoh" to "anon";

grant select on table "public"."senior_sdoh" to "anon";

grant trigger on table "public"."senior_sdoh" to "anon";

grant truncate on table "public"."senior_sdoh" to "anon";

grant update on table "public"."senior_sdoh" to "anon";

grant delete on table "public"."senior_sdoh" to "authenticated";

grant insert on table "public"."senior_sdoh" to "authenticated";

grant references on table "public"."senior_sdoh" to "authenticated";

grant select on table "public"."senior_sdoh" to "authenticated";

grant trigger on table "public"."senior_sdoh" to "authenticated";

grant truncate on table "public"."senior_sdoh" to "authenticated";

grant update on table "public"."senior_sdoh" to "authenticated";

grant delete on table "public"."senior_sdoh" to "service_role";

grant insert on table "public"."senior_sdoh" to "service_role";

grant references on table "public"."senior_sdoh" to "service_role";

grant select on table "public"."senior_sdoh" to "service_role";

grant trigger on table "public"."senior_sdoh" to "service_role";

grant truncate on table "public"."senior_sdoh" to "service_role";

grant update on table "public"."senior_sdoh" to "service_role";

grant delete on table "public"."user_roles_audit" to "anon";

grant insert on table "public"."user_roles_audit" to "anon";

grant references on table "public"."user_roles_audit" to "anon";

grant select on table "public"."user_roles_audit" to "anon";

grant trigger on table "public"."user_roles_audit" to "anon";

grant truncate on table "public"."user_roles_audit" to "anon";

grant update on table "public"."user_roles_audit" to "anon";

grant delete on table "public"."user_roles_audit" to "authenticated";

grant insert on table "public"."user_roles_audit" to "authenticated";

grant references on table "public"."user_roles_audit" to "authenticated";

grant select on table "public"."user_roles_audit" to "authenticated";

grant trigger on table "public"."user_roles_audit" to "authenticated";

grant truncate on table "public"."user_roles_audit" to "authenticated";

grant update on table "public"."user_roles_audit" to "authenticated";

grant delete on table "public"."user_roles_audit" to "service_role";

grant insert on table "public"."user_roles_audit" to "service_role";

grant references on table "public"."user_roles_audit" to "service_role";

grant select on table "public"."user_roles_audit" to "service_role";

grant trigger on table "public"."user_roles_audit" to "service_role";

grant truncate on table "public"."user_roles_audit" to "service_role";

grant update on table "public"."user_roles_audit" to "service_role";

create policy "admins can insert enrollment logs"
on "public"."admin_enroll_audit"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));


create policy "admins can read enrollment logs"
on "public"."admin_enroll_audit"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));


create policy "admin_notes_audit_insert_trigger_only"
on "public"."admin_notes_audit"
as permissive
for insert
to public
with check ((pg_trigger_depth() > 0));


create policy "admin_notes_audit_select_admins"
on "public"."admin_notes_audit"
as permissive
for select
to public
using (is_admin_or_super_admin());


create policy "delete_super_admins_only"
on "public"."admin_pin_attempts_log"
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN roles r ON ((r.id = p.role_id)))
  WHERE ((p.user_id = auth.uid()) AND (r.name = 'super_admin'::text)))));


create policy "update_super_admins_only"
on "public"."admin_pin_attempts_log"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN roles r ON ((r.id = p.role_id)))
  WHERE ((p.user_id = auth.uid()) AND (r.name = 'super_admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN roles r ON ((r.id = p.role_id)))
  WHERE ((p.user_id = auth.uid()) AND (r.name = 'super_admin'::text)))));


create policy "uq_delete_super"
on "public"."admin_user_questions"
as permissive
for delete
to public
using (is_super_admin());


create policy "uq_insert_self"
on "public"."admin_user_questions"
as permissive
for insert
to public
with check (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "uq_select_self"
on "public"."admin_user_questions"
as permissive
for select
to public
using (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "uq_update_self_or_admin"
on "public"."admin_user_questions"
as permissive
for update
to public
using (((user_id = auth.uid()) OR is_admin_or_super_admin()))
with check (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "admin_self_select"
on "public"."admin_users"
as permissive
for select
to authenticated
using ((user_id = auth.uid()));


create policy "alerts_admin_cu"
on "public"."alerts"
as permissive
for insert
to public
with check (is_admin_or_super_admin());


create policy "alerts_admin_cud"
on "public"."alerts"
as permissive
for all
to public
using (is_admin_or_super_admin())
with check (is_admin_or_super_admin());


create policy "alerts_admin_u"
on "public"."alerts"
as permissive
for update
to public
using (is_admin_or_super_admin())
with check (is_admin_or_super_admin());


create policy "alerts_delete_super"
on "public"."alerts"
as permissive
for delete
to public
using (is_super_admin());


create policy "alerts_select_self_or_admin"
on "public"."alerts"
as permissive
for select
to public
using (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "alerts_update_is_read_self"
on "public"."alerts"
as permissive
for update
to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));


create policy "api_keys_admin_cud"
on "public"."api_keys"
as permissive
for all
to public
using (is_admin_or_super_admin())
with check (is_admin_or_super_admin());


create policy "api_keys_admin_select"
on "public"."api_keys"
as permissive
for select
to public
using (is_admin_or_super_admin());


create policy "cg_attempts_insert"
on "public"."caregiver_pin_attempts"
as permissive
for insert
to public
with check (is_service_or_admin());


create policy "cg_attempts_select"
on "public"."caregiver_pin_attempts"
as permissive
for select
to public
using ((is_service_or_admin() OR (auth.uid() = caregiver_user_id)));


create policy "cg_pins_admin_select"
on "public"."caregiver_pins"
as permissive
for select
to public
using (is_service_or_admin());


create policy "cg_pins_self_update"
on "public"."caregiver_pins"
as permissive
for update
to public
using ((auth.uid() = senior_user_id))
with check ((auth.uid() = senior_user_id));


create policy "cg_pins_self_upsert"
on "public"."caregiver_pins"
as permissive
for insert
to public
with check ((auth.uid() = senior_user_id));


create policy "cg_grants_insert"
on "public"."caregiver_view_grants"
as permissive
for insert
to public
with check (is_service_or_admin());


create policy "cg_grants_select"
on "public"."caregiver_view_grants"
as permissive
for select
to public
using ((is_service_or_admin() OR (auth.uid() = caregiver_user_id) OR (auth.uid() = senior_user_id)));


create policy "check_ins_audit_insert_trigger_only"
on "public"."check_ins_audit"
as permissive
for insert
to public
with check ((pg_trigger_depth() > 0));


create policy "check_ins_audit_select_admins"
on "public"."check_ins_audit"
as permissive
for select
to public
using (is_admin_or_super_admin());


create policy "cr_delete_super"
on "public"."comment_reports"
as permissive
for delete
to public
using (is_super_admin());


create policy "cr_insert_any"
on "public"."comment_reports"
as permissive
for insert
to public
with check ((auth.uid() IS NOT NULL));


create policy "cr_insert_any_authenticated"
on "public"."comment_reports"
as permissive
for insert
to public
with check ((auth.uid() IS NOT NULL));


create policy "cr_select_self_or_admin"
on "public"."comment_reports"
as permissive
for select
to public
using (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "cr_update_admin"
on "public"."comment_reports"
as permissive
for update
to public
using (is_admin_or_super_admin())
with check (is_admin_or_super_admin());


create policy "comments_delete_super"
on "public"."comments"
as permissive
for delete
to public
using (is_super_admin());


create policy "comments_insert_self"
on "public"."comments"
as permissive
for insert
to public
with check (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "comments_select_all"
on "public"."comments"
as permissive
for select
to public
using (true);


create policy "comments_update_self_or_admin"
on "public"."comments"
as permissive
for update
to public
using (((user_id = auth.uid()) OR is_admin_or_super_admin()))
with check (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "consent_delete_super"
on "public"."consent_log"
as permissive
for delete
to public
using (is_super_admin());


create policy "consent_insert_self_or_admin"
on "public"."consent_log"
as permissive
for insert
to public
with check (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "consent_select_self_or_admin"
on "public"."consent_log"
as permissive
for select
to public
using (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "fcm_tokens_admin"
on "public"."fcm_tokens"
as permissive
for all
to public
using (is_admin_or_super_admin())
with check (is_admin_or_super_admin());


create policy "fcm_tokens_manage_own"
on "public"."fcm_tokens"
as permissive
for all
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can insert own geofence events"
on "public"."geofence_events"
as permissive
for insert
to public
with check ((auth.uid() = patient_id));


create policy "Users can view own geofence events"
on "public"."geofence_events"
as permissive
for select
to public
using ((auth.uid() = patient_id));


create policy "Users can view own geofence zones"
on "public"."geofence_zones"
as permissive
for all
to public
using ((auth.uid() = patient_id));


create policy "Users can manage own devices"
on "public"."mobile_devices"
as permissive
for all
to public
using ((auth.uid() = patient_id));


create policy "Users can manage own emergency contacts"
on "public"."mobile_emergency_contacts"
as permissive
for all
to public
using ((auth.uid() = patient_id));


create policy "Admins can view all emergency incidents"
on "public"."mobile_emergency_incidents"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role_code = ANY (ARRAY[1, 2, 3, 12]))))));


create policy "Users can insert own emergency incidents"
on "public"."mobile_emergency_incidents"
as permissive
for insert
to public
with check ((auth.uid() = patient_id));


create policy "Users can view own emergency incidents"
on "public"."mobile_emergency_incidents"
as permissive
for select
to public
using ((auth.uid() = patient_id));


create policy "Users can manage own sync status"
on "public"."mobile_sync_status"
as permissive
for all
to public
using ((auth.uid() = patient_id));


create policy "Admins can view all mobile vitals"
on "public"."mobile_vitals"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role_code = ANY (ARRAY[1, 2, 3, 12]))))));


create policy "Users can insert own mobile vitals"
on "public"."mobile_vitals"
as permissive
for insert
to public
with check ((auth.uid() = patient_id));


create policy "Users can view own mobile vitals"
on "public"."mobile_vitals"
as permissive
for select
to public
using ((auth.uid() = patient_id));


create policy "Users can insert own movement patterns"
on "public"."movement_patterns"
as permissive
for insert
to public
with check ((auth.uid() = patient_id));


create policy "Users can view own movement patterns"
on "public"."movement_patterns"
as permissive
for select
to public
using ((auth.uid() = patient_id));


create policy "Admins can view all location data"
on "public"."patient_locations"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role_code = ANY (ARRAY[1, 2, 3, 12]))))));


create policy "Users can insert own location data"
on "public"."patient_locations"
as permissive
for insert
to public
with check ((auth.uid() = patient_id));


create policy "Users can view own location data"
on "public"."patient_locations"
as permissive
for select
to public
using ((auth.uid() = patient_id));


create policy "Admins can manage all profiles"
on "public"."profiles"
as permissive
for all
to public
using (check_user_has_role(ARRAY['admin'::text, 'super_admin'::text]))
with check (check_user_has_role(ARRAY['admin'::text, 'super_admin'::text]));


create policy "Users can update their own profile"
on "public"."profiles"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check (((auth.uid() = user_id) AND ((role_id = ( SELECT profiles_1.role_id
   FROM profiles profiles_1
  WHERE (profiles_1.user_id = auth.uid()))) OR check_user_has_role(ARRAY['admin'::text, 'super_admin'::text]))));


create policy "Users can view their own profile"
on "public"."profiles"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "profiles_delete"
on "public"."profiles"
as permissive
for delete
to public
using (is_super_admin());


create policy "profiles_insert_admin"
on "public"."profiles"
as permissive
for insert
to public
with check (is_admin_or_super_admin());


create policy "profiles_self_read"
on "public"."profiles"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "profiles_self_write"
on "public"."profiles"
as permissive
for update
to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));


create policy "read own profile"
on "public"."profiles"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "update own profile"
on "public"."profiles"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can delete their own push tokens"
on "public"."push_subscriptions"
as permissive
for delete
to authenticated
using ((auth.uid() = user_id));


create policy "Users can insert their own push tokens"
on "public"."push_subscriptions"
as permissive
for insert
to authenticated
with check ((auth.uid() = user_id));


create policy "Users can select their own push tokens"
on "public"."push_subscriptions"
as permissive
for select
to authenticated
using ((auth.uid() = user_id));


create policy "Users can update their own push tokens"
on "public"."push_subscriptions"
as permissive
for update
to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Super Admins only"
on "public"."rate_limit_admin"
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role_id = 2)))));


create policy "allow_super_admin_all"
on "public"."rate_limit_admin"
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN roles r ON ((r.id = p.role_id)))
  WHERE ((p.user_id = auth.uid()) AND (r.name = 'super_admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN roles r ON ((r.id = p.role_id)))
  WHERE ((p.user_id = auth.uid()) AND (r.name = 'super_admin'::text)))));


create policy "service role can insert"
on "public"."rate_limit_registrations"
as permissive
for insert
to public
with check ((auth.role() = 'service_role'::text));


create policy "service role can select"
on "public"."rate_limit_registrations"
as permissive
for select
to public
using ((auth.role() = 'service_role'::text));


create policy "roles_delete_super"
on "public"."roles"
as permissive
for delete
to public
using (is_super_admin());


create policy "roles_insert_super"
on "public"."roles"
as permissive
for insert
to public
with check (is_super_admin());


create policy "roles_select_admins"
on "public"."roles"
as permissive
for select
to public
using (is_admin_or_super_admin());


create policy "roles_select_authenticated"
on "public"."roles"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "roles_update_super"
on "public"."roles"
as permissive
for update
to public
using (is_super_admin())
with check (is_super_admin());


create policy "selfreports_caregiver_view"
on "public"."self_reports"
as permissive
for select
to public
using (((auth.uid() = user_id) OR is_service_or_admin() OR caregiver_has_grant(user_id)));


create policy "sr_delete_super"
on "public"."self_reports"
as permissive
for delete
to public
using (is_super_admin());


create policy "sr_insert_self_or_admin"
on "public"."self_reports"
as permissive
for insert
to public
with check (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "sr_select_self_or_admin"
on "public"."self_reports"
as permissive
for select
to public
using (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "sr_update_self_or_admin"
on "public"."self_reports"
as permissive
for update
to public
using (((user_id = auth.uid()) OR is_admin_or_super_admin()))
with check (((user_id = auth.uid()) OR is_admin_or_super_admin()));


create policy "sdemo_insert"
on "public"."senior_demographics"
as permissive
for insert
to public
with check (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "sdemo_select"
on "public"."senior_demographics"
as permissive
for select
to public
using (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "sdemo_update"
on "public"."senior_demographics"
as permissive
for update
to public
using (((auth.uid() = user_id) OR is_service_or_admin()))
with check (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "sec_delete"
on "public"."senior_emergency_contacts"
as permissive
for delete
to public
using (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "sec_insert"
on "public"."senior_emergency_contacts"
as permissive
for insert
to public
with check (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "sec_select"
on "public"."senior_emergency_contacts"
as permissive
for select
to public
using (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "sec_update"
on "public"."senior_emergency_contacts"
as permissive
for update
to public
using (((auth.uid() = user_id) OR is_service_or_admin()))
with check (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "shealth_caregiver_view"
on "public"."senior_health"
as permissive
for select
to public
using (((auth.uid() = user_id) OR is_service_or_admin() OR caregiver_has_grant(user_id)));


create policy "shealth_insert"
on "public"."senior_health"
as permissive
for insert
to public
with check (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "shealth_select"
on "public"."senior_health"
as permissive
for select
to public
using (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "shealth_update"
on "public"."senior_health"
as permissive
for update
to public
using (((auth.uid() = user_id) OR is_service_or_admin()))
with check (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "sdoh_insert"
on "public"."senior_sdoh"
as permissive
for insert
to public
with check (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "sdoh_select"
on "public"."senior_sdoh"
as permissive
for select
to public
using (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "sdoh_update"
on "public"."senior_sdoh"
as permissive
for update
to public
using (((auth.uid() = user_id) OR is_service_or_admin()))
with check (((auth.uid() = user_id) OR is_service_or_admin()));


create policy "roles_delete_by_super_admin"
on "public"."user_roles"
as permissive
for delete
to authenticated
using (is_super_admin());


create policy "roles_insert_by_super_admin"
on "public"."user_roles"
as permissive
for insert
to authenticated
with check (is_super_admin());


create policy "roles_select_by_super_admin"
on "public"."user_roles"
as permissive
for select
to authenticated
using (is_super_admin());


create policy "roles_update_by_super_admin"
on "public"."user_roles"
as permissive
for update
to authenticated
using (is_super_admin())
with check (is_super_admin());


create policy "user_roles_delete_block"
on "public"."user_roles"
as permissive
for delete
to public
using (false);


create policy "user_roles_delete_super"
on "public"."user_roles"
as permissive
for delete
to public
using (is_super_admin());


create policy "user_roles_insert_block"
on "public"."user_roles"
as permissive
for insert
to public
with check (false);


create policy "user_roles_select_admins"
on "public"."user_roles"
as permissive
for select
to public
using (is_admin_or_super_admin());


create policy "user_roles_update_block"
on "public"."user_roles"
as permissive
for update
to public
using (false)
with check (false);


create policy "user_roles_audit_insert_trigger_only"
on "public"."user_roles_audit"
as permissive
for insert
to public
with check ((pg_trigger_depth() > 0));


create policy "user_roles_audit_select_admins"
on "public"."user_roles_audit"
as permissive
for select
to public
using (is_admin_or_super_admin());


CREATE TRIGGER trg_user_questions_touch BEFORE UPDATE ON public.admin_user_questions FOR EACH ROW EXECUTE FUNCTION user_questions_touch();

CREATE TRIGGER set_timestamp_on_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_profiles_restrict BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION profiles_restrict_user_update();

CREATE TRIGGER trg_sync_user_roles AFTER INSERT OR UPDATE OF role_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION sync_user_roles_from_profiles();

CREATE TRIGGER trg_log_user_roles_delete BEFORE DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION log_user_roles_delete();


