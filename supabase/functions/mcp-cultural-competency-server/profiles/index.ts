// =====================================================
// Cultural Competency Profiles — Barrel Export & Lookup
// =====================================================

import type { CulturalProfile, PopulationKey } from "../types.ts";
import { veteransProfile } from "./veterans.ts";
import { unhousedProfile } from "./unhoused.ts";
import { latinoProfile } from "./latino.ts";
import { blackAAProfile } from "./blackAA.ts";
import { isolatedElderlyProfile } from "./isolatedElderly.ts";
import { indigenousProfile } from "./indigenous.ts";
import { immigrantRefugeeProfile } from "./immigrantRefugee.ts";
import { lgbtqElderlyProfile } from "./lgbtqElderly.ts";

/** Registry of all available population profiles */
const PROFILE_REGISTRY: Record<string, CulturalProfile> = {
  veterans: veteransProfile,
  unhoused: unhousedProfile,
  latino: latinoProfile,
  black_aa: blackAAProfile,
  isolated_elderly: isolatedElderlyProfile,
  indigenous: indigenousProfile,
  immigrant_refugee: immigrantRefugeeProfile,
  lgbtq_elderly: lgbtqElderlyProfile,
};

/**
 * Look up a population profile by key.
 * Returns null if the population is not found.
 */
export function getProfile(population: string): CulturalProfile | null {
  const key = population.toLowerCase().replace(/[\s-]+/g, "_");
  return PROFILE_REGISTRY[key] ?? null;
}

/**
 * Get all available population keys.
 */
export function getAvailablePopulations(): PopulationKey[] {
  return Object.keys(PROFILE_REGISTRY) as PopulationKey[];
}

/**
 * Check if a population key is valid and has a profile.
 */
export function hasProfile(population: string): boolean {
  const key = population.toLowerCase().replace(/[\s-]+/g, "_");
  return key in PROFILE_REGISTRY;
}

export {
  veteransProfile,
  unhousedProfile,
  latinoProfile,
  blackAAProfile,
  isolatedElderlyProfile,
  indigenousProfile,
  immigrantRefugeeProfile,
  lgbtqElderlyProfile,
};
