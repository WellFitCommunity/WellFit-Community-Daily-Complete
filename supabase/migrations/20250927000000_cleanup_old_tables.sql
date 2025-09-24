drop trigger if exists "trg_risk_assessments_updated_at" on "public"."risk_assessments";

drop policy "users_can_view_active_templates" on "public"."question_templates";

drop policy "risk_assessments_healthcare_insert" on "public"."risk_assessments";

drop policy "risk_assessments_healthcare_select_all" on "public"."risk_assessments";

drop policy "risk_assessments_healthcare_update_own" on "public"."risk_assessments";

drop policy "risk_assessments_select_own" on "public"."risk_assessments";

drop policy "admins_can_update_questions" on "public"."user_questions";

drop policy "admins_can_view_all_questions" on "public"."user_questions";

drop policy "users_can_insert_own_questions" on "public"."user_questions";

drop policy "users_can_view_own_questions" on "public"."user_questions";

revoke delete on table "public"."question_templates" from "anon";

revoke insert on table "public"."question_templates" from "anon";

revoke references on table "public"."question_templates" from "anon";

revoke select on table "public"."question_templates" from "anon";

revoke trigger on table "public"."question_templates" from "anon";

revoke truncate on table "public"."question_templates" from "anon";

revoke update on table "public"."question_templates" from "anon";

revoke delete on table "public"."question_templates" from "authenticated";

revoke insert on table "public"."question_templates" from "authenticated";

revoke references on table "public"."question_templates" from "authenticated";

revoke select on table "public"."question_templates" from "authenticated";

revoke trigger on table "public"."question_templates" from "authenticated";

revoke truncate on table "public"."question_templates" from "authenticated";

revoke update on table "public"."question_templates" from "authenticated";

revoke delete on table "public"."question_templates" from "service_role";

revoke insert on table "public"."question_templates" from "service_role";

revoke references on table "public"."question_templates" from "service_role";

revoke select on table "public"."question_templates" from "service_role";

revoke trigger on table "public"."question_templates" from "service_role";

revoke truncate on table "public"."question_templates" from "service_role";

revoke update on table "public"."question_templates" from "service_role";

revoke delete on table "public"."risk_assessments" from "anon";

revoke insert on table "public"."risk_assessments" from "anon";

revoke references on table "public"."risk_assessments" from "anon";

revoke select on table "public"."risk_assessments" from "anon";

revoke trigger on table "public"."risk_assessments" from "anon";

revoke truncate on table "public"."risk_assessments" from "anon";

revoke update on table "public"."risk_assessments" from "anon";

revoke delete on table "public"."risk_assessments" from "authenticated";

revoke insert on table "public"."risk_assessments" from "authenticated";

revoke references on table "public"."risk_assessments" from "authenticated";

revoke select on table "public"."risk_assessments" from "authenticated";

revoke trigger on table "public"."risk_assessments" from "authenticated";

revoke truncate on table "public"."risk_assessments" from "authenticated";

revoke update on table "public"."risk_assessments" from "authenticated";

revoke delete on table "public"."risk_assessments" from "service_role";

revoke insert on table "public"."risk_assessments" from "service_role";

revoke references on table "public"."risk_assessments" from "service_role";

revoke select on table "public"."risk_assessments" from "service_role";

revoke trigger on table "public"."risk_assessments" from "service_role";

revoke truncate on table "public"."risk_assessments" from "service_role";

revoke update on table "public"."risk_assessments" from "service_role";

revoke delete on table "public"."user_questions" from "anon";

revoke insert on table "public"."user_questions" from "anon";

revoke references on table "public"."user_questions" from "anon";

revoke select on table "public"."user_questions" from "anon";

revoke trigger on table "public"."user_questions" from "anon";

revoke truncate on table "public"."user_questions" from "anon";

revoke update on table "public"."user_questions" from "anon";

revoke delete on table "public"."user_questions" from "authenticated";

revoke insert on table "public"."user_questions" from "authenticated";

revoke references on table "public"."user_questions" from "authenticated";

revoke select on table "public"."user_questions" from "authenticated";

revoke trigger on table "public"."user_questions" from "authenticated";

revoke truncate on table "public"."user_questions" from "authenticated";

revoke update on table "public"."user_questions" from "authenticated";

revoke delete on table "public"."user_questions" from "service_role";

revoke insert on table "public"."user_questions" from "service_role";

revoke references on table "public"."user_questions" from "service_role";

revoke select on table "public"."user_questions" from "service_role";

revoke trigger on table "public"."user_questions" from "service_role";

revoke truncate on table "public"."user_questions" from "service_role";

revoke update on table "public"."user_questions" from "service_role";

alter table "public"."risk_assessments" drop constraint "risk_assessments_assessor_id_fkey";

alter table "public"."risk_assessments" drop constraint "risk_assessments_cognitive_risk_score_check";

alter table "public"."risk_assessments" drop constraint "risk_assessments_medical_risk_score_check";

alter table "public"."risk_assessments" drop constraint "risk_assessments_mobility_risk_score_check";

alter table "public"."risk_assessments" drop constraint "risk_assessments_overall_score_check";

alter table "public"."risk_assessments" drop constraint "risk_assessments_patient_id_fkey";

alter table "public"."risk_assessments" drop constraint "risk_assessments_priority_check";

alter table "public"."risk_assessments" drop constraint "risk_assessments_review_frequency_check";

alter table "public"."risk_assessments" drop constraint "risk_assessments_risk_level_check";

alter table "public"."risk_assessments" drop constraint "risk_assessments_social_risk_score_check";

alter table "public"."user_questions" drop constraint "user_questions_category_check";

alter table "public"."user_questions" drop constraint "user_questions_responded_by_fkey";

alter table "public"."user_questions" drop constraint "user_questions_status_check";

alter table "public"."user_questions" drop constraint "user_questions_urgency_check";

alter table "public"."user_questions" drop constraint "user_questions_user_id_fkey1";

drop function if exists "public"."tg_risk_assessments_updated_at"();

alter table "public"."question_templates" drop constraint "question_templates_pkey";

alter table "public"."risk_assessments" drop constraint "risk_assessments_pkey";

alter table "public"."user_questions" drop constraint "user_questions_pkey1";

drop index if exists "public"."idx_risk_assessments_assessor_id";

drop index if exists "public"."idx_risk_assessments_created_at";

drop index if exists "public"."idx_risk_assessments_patient_id";

drop index if exists "public"."idx_risk_assessments_risk_level";

drop index if exists "public"."idx_risk_assessments_valid_until";

drop index if exists "public"."idx_user_questions_created_at";

drop index if exists "public"."idx_user_questions_status";

drop index if exists "public"."idx_user_questions_urgency";

drop index if exists "public"."idx_user_questions_user_id";

drop index if exists "public"."question_templates_pkey";

drop index if exists "public"."risk_assessments_pkey";

drop index if exists "public"."user_questions_pkey1";

drop table "public"."question_templates";

drop table "public"."risk_assessments";

drop table "public"."user_questions";


