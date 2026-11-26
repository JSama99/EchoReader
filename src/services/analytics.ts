import * as Crypto from 'expo-crypto';

import { enqueue, envelope, type AnalyticsEvent, type Envelope } from '@/domain/analytics';

import { config } from './config';

/**
 * Analytics client. There is no transport configured in this build, so
 * consented events stay in a bounded in-memory queue the reader can inspect
 * (Profile → Privacy) and are discarded when consent is withdrawn or the app
 * quits. A real transport plugs in at `flush`.
 */

let consent = false;
let queue: Envelope[] = [];
const session = Crypto.randomUUID();
const synthetic = (typeof __DEV__ !== 'undefined' && __DEV__) || config.commerce === 'sandbox';

export function setConsent(v: boolean) {
  consent = v;
  if (!v) queue = [];
}

export function track(e: AnalyticsEvent) {
  queue = enqueue(queue, envelope(e, { consent, session, synthetic, now: Date.now() }));
}

export const queued = (): readonly Envelope[] => queue;

/** Sends nothing: no analytics endpoint is configured. Returns how many events are held. */
export async function flush(): Promise<number> {
  return queue.length;
}
