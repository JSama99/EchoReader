import { config } from './config';

/**
 * Identity. Every reader starts (and can stay) a guest: the free reader,
 * imports, progress and Embers all work without an account.
 *
 * Accounts (sign in with Apple / Google / email, sync, purchase restore across
 * devices, account deletion) are designed for Supabase Auth — see
 * docs/v0.2/04-DOMAIN-AND-DATA.md and supabase/ — but are not connected in
 * this build because no backend project exists yet.
 */
export type Identity = { kind: 'guest' };

export const identity: Identity = { kind: 'guest' };

export const accountsStatus: 'not-configured' | 'configured-not-connected' = config.backendUrl ? 'configured-not-connected' : 'not-configured';
