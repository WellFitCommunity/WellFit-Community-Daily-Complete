/**
 * Community Moments — Barrel Re-export
 *
 * Maintains backward compatibility: `import CommunityMoments from '../components/CommunityMoments'`
 * continues to work via the old file which re-exports from here.
 */
export { default } from './CommunityMoments';
export type { Moment, Affirmation, Profile } from './types';
