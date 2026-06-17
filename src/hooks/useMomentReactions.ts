/**
 * useMomentReactions — Emoji reactions for community moments (posts)
 *
 * Fetches the reaction rows for a set of moments in ONE query (avoids N+1),
 * exposes per-moment counts and the current user's own reactions, and a
 * `toggle` that optimistically adds/removes a reaction.
 *
 * Backed by the `community_moment_reactions` table (tenant-scoped RLS;
 * tenant_id is filled by a DB default of get_current_tenant_id()).
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { auditLogger } from '../services/auditLogger';

export type ReactionCounts = Record<string, Record<string, number>>; // momentId -> emoji -> count
export type MyReactions = Record<string, string[]>; // momentId -> emojis the user reacted with

interface ReactionRow {
  moment_id: number | string;
  user_id: string;
  emoji: string;
}

interface UseMomentReactionsResult {
  counts: ReactionCounts;
  mine: MyReactions;
  toggle: (momentId: number | string, emoji: string) => Promise<void>;
}

const key = (id: number | string): string => String(id);

export function useMomentReactions(
  supabase: SupabaseClient,
  momentIds: Array<number | string>,
  userId: string | null,
): UseMomentReactionsResult {
  const [counts, setCounts] = useState<ReactionCounts>({});
  const [mine, setMine] = useState<MyReactions>({});

  // Stable dependency: the sorted set of ids currently on screen.
  const idsKey = useMemo(
    () => Array.from(new Set(momentIds.map(key))).sort().join(','),
    [momentIds],
  );

  const buildState = useCallback(
    (rows: ReactionRow[]) => {
      const nextCounts: ReactionCounts = {};
      const nextMine: MyReactions = {};
      for (const r of rows) {
        const mId = key(r.moment_id);
        nextCounts[mId] = nextCounts[mId] || {};
        nextCounts[mId][r.emoji] = (nextCounts[mId][r.emoji] || 0) + 1;
        if (userId && r.user_id === userId) {
          nextMine[mId] = nextMine[mId] || [];
          if (!nextMine[mId].includes(r.emoji)) nextMine[mId].push(r.emoji);
        }
      }
      setCounts(nextCounts);
      setMine(nextMine);
    },
    [userId],
  );

  const refetch = useCallback(async () => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) {
      setCounts({});
      setMine({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from('community_moment_reactions')
        .select('moment_id, user_id, emoji')
        .in('moment_id', ids);
      if (error) throw error;
      buildState((data ?? []) as ReactionRow[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'MOMENT_REACTIONS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { momentCount: ids.length },
      );
    }
  }, [supabase, idsKey, buildState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) await refetch();
    })();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  const toggle = useCallback(
    async (momentId: number | string, emoji: string) => {
      if (!userId) return;
      const mId = key(momentId);
      const hasReacted = (mine[mId] || []).includes(emoji);

      // Optimistic update
      setMine((prev) => {
        const list = prev[mId] || [];
        return {
          ...prev,
          [mId]: hasReacted ? list.filter((e) => e !== emoji) : [...list, emoji],
        };
      });
      setCounts((prev) => {
        const cur = { ...(prev[mId] || {}) };
        cur[emoji] = Math.max(0, (cur[emoji] || 0) + (hasReacted ? -1 : 1));
        return { ...prev, [mId]: cur };
      });

      try {
        if (hasReacted) {
          const { error } = await supabase
            .from('community_moment_reactions')
            .delete()
            .eq('moment_id', momentId)
            .eq('user_id', userId)
            .eq('emoji', emoji);
          if (error) throw error;
        } else {
          // tenant_id is filled by the column default (get_current_tenant_id()).
          const { error } = await supabase
            .from('community_moment_reactions')
            .insert({ moment_id: momentId, user_id: userId, emoji });
          // 23505 = unique violation (already reacted) — safe to ignore.
          if (error && error.code !== '23505') throw error;
        }
      } catch (err: unknown) {
        await auditLogger.error(
          'MOMENT_REACTION_TOGGLE_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { momentId: mId, emoji },
        );
        // Revert to server truth
        await refetch();
      }
    },
    [supabase, userId, mine, refetch],
  );

  return { counts, mine, toggle };
}
