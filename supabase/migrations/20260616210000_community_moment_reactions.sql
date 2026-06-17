-- Community Moment Reactions
--
-- Tappable emoji reactions members add UNDER each community moment (post).
-- One row per (moment, user, emoji); members may add several different emojis
-- to the same post and remove any of them (toggle).
--
-- Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

CREATE TABLE IF NOT EXISTS public.community_moment_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id   BIGINT NOT NULL REFERENCES public.community_moments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  tenant_id   UUID NOT NULL DEFAULT get_current_tenant_id() REFERENCES public.tenants(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT community_moment_reactions_unique UNIQUE (moment_id, user_id, emoji),
  CONSTRAINT community_moment_reactions_emoji_check
    CHECK (emoji IN ('👍', '❤️', '😊', '🎉', '🌸', '🙏'))
);

-- RLS: members see and manage reactions only within their own tenant.
ALTER TABLE public.community_moment_reactions ENABLE ROW LEVEL SECURITY;

-- Read: anyone in the same tenant can see the reactions (drives the counts).
CREATE POLICY "cmr_select_tenant" ON public.community_moment_reactions
  FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- Insert: a member may add only their OWN reaction, scoped to their tenant.
CREATE POLICY "cmr_insert_own" ON public.community_moment_reactions
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

-- Delete: a member may remove only their OWN reaction.
CREATE POLICY "cmr_delete_own" ON public.community_moment_reactions
  FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_cmr_moment ON public.community_moment_reactions(moment_id);
CREATE INDEX IF NOT EXISTS idx_cmr_tenant ON public.community_moment_reactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmr_user   ON public.community_moment_reactions(user_id);

COMMENT ON TABLE public.community_moment_reactions IS
  'Emoji reactions members tap under community moments (posts). One row per (moment, user, emoji). RLS: tenant-scoped read, own-row write.';
