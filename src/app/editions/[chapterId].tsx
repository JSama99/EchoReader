import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { allEditions, editionsFor, getChapter, getSeries, publicationOf } from '@/content/catalog';
import { ACCESS_LABEL, canOpen, canReadFully } from '@/domain/commerce/access';
import { formatMoney } from '@/domain/commerce/ledger';
import type { Edition } from '@/domain/commerce/types';
import { formatCountdown } from '@/domain/rewards';
import { track } from '@/services/analytics';
import { commerce } from '@/services/commerce';
import { useAccess, useNow } from '@/state/derived';
import { useDispatch } from '@/state/store';
import { color, radius } from '@/theme/tokens';
import { Back, Check } from '@/ui/icons';
import { Button, IconButton, T } from '@/ui/kit';

const TIER_TONE = { standard: color.bone, collector: color.storm, legendary: color.glyph } as const;

/**
 * Availability and editions for one publication. Every edition includes the
 * complete readable chapter; collector benefits are described honestly,
 * because minting does not exist yet.
 */
export default function Editions() {
  const { chapterId = '' } = useLocalSearchParams<{ chapterId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const now = useNow();
  const access = useAccess(chapterId, now);
  const chapter = getChapter(chapterId);
  const pub = publicationOf(chapterId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track({ name: 'edition_view', publicationId: chapterId });
  }, [chapterId]);

  if (!chapter || !pub || !access) return <Redirect href="/" />;
  const series = getSeries(chapter.seriesId);
  const editions = editionsFor(chapterId).filter((e) => e.onSale);
  const hasPages = chapter.pages.length > 0;
  const awaiting = chapter.contentStatus === 'awaiting-master';

  const buy = async (e: Edition) => {
    setError(null);
    setBusy(e.id);
    track({ name: 'edition_select', publicationId: chapterId, tier: e.tier });
    track({ name: 'purchase_start', publicationId: chapterId, tier: e.tier });
    try {
      const tx = await commerce.purchase(e);
      dispatch({ type: 'applyTransactions', transactions: [tx], editions: allEditions() });
      track({ name: 'purchase_complete', publicationId: chapterId, tier: e.tier });
    } catch {
      setError('The purchase didn’t go through. You haven’t been charged.');
      track({ name: 'purchase_failed', publicationId: chapterId, tier: e.tier });
    } finally {
      setBusy(null);
    }
  };

  const status = (() => {
    if (awaiting) return 'The approved pages for this chapter haven’t been released yet.';
    switch (access.kind) {
      case 'scheduled':
        return `Releases in ${formatCountdown(Date.parse(access.releaseAt) - now)}.`;
      case 'unpublished':
        return 'Not yet published.';
      case 'unavailable':
        return 'This publication isn’t available right now.';
      case 'preview':
        return `The first ${access.previewPages} pages are free to preview.`;
      case 'paid':
        return 'Choose an edition to read this chapter.';
      default:
        return ACCESS_LABEL[access.kind];
    }
  })();

  const owned = canReadFully(access);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}>
      <View style={{ paddingHorizontal: 8 }}>
        <IconButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Back />
        </IconButton>
      </View>
      <View style={{ paddingHorizontal: 24, gap: 10, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <T v="kicker">
          {series?.title ?? ''} · {chapter.label}
        </T>
        <T v="headline" style={{ fontSize: 30, lineHeight: 34 }}>
          {chapter.title}
        </T>
        <View style={styles.status}>
          <T v="mono" style={{ color: owned ? color.ember : color.smoke }}>
            {awaiting ? 'COMING SOON' : ACCESS_LABEL[access.kind].toUpperCase()}
          </T>
          <T v="body">{status}</T>
        </View>

        {hasPages && canOpen(access, chapter.pages.length) && (
          <Button label={owned ? 'Read now' : 'Read the preview'} onPress={() => router.replace(`/read/${chapter.id}`)} />
        )}

        {!owned && editions.length > 0 && (
          <View style={{ gap: 14, paddingTop: 14 }}>
            <T v="title">Editions</T>
            <T v="caption">Every edition includes the complete chapter. Prices and benefits are set by the publisher.</T>
            {editions.map((e) => (
              <View key={e.id} style={[styles.edition, { borderColor: e.tier === 'standard' ? color.ash : TIER_TONE[e.tier] }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <T v="bodyStrong" style={{ color: TIER_TONE[e.tier], flex: 1 }}>
                    {e.title}
                  </T>
                  <T v="title">{formatMoney(e.price)}</T>
                </View>
                {e.benefits.map((b) => (
                  <View key={b} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <Check size={16} color={TIER_TONE[e.tier]} />
                    <T v="caption" style={{ flex: 1 }}>
                      {b}
                    </T>
                  </View>
                ))}
                {e.collectible && (
                  <T v="caption" style={{ fontSize: 12, color: color.smoke }}>
                    Collectible minting isn’t live yet. Your edition is recorded now and marked “Reserved” in your Vault until a blockchain record exists.
                    Owning a collectible never affects reading access, and it isn’t an investment.
                  </T>
                )}
                <Button
                  kind={e.tier === 'standard' ? 'ember' : 'ghost'}
                  label={!commerce.available ? commerce.label : !hasPages ? 'Available at release' : busy === e.id ? 'Processing…' : `Buy · ${formatMoney(e.price)}`}
                  disabled={!commerce.available || !hasPages || !!busy}
                  onPress={() => buy(e)}
                />
                {commerce.kind === 'sandbox' && commerce.available && hasPages && (
                  <T v="mono" style={{ fontSize: 10, textAlign: 'center' }}>
                    SANDBOX · NO CHARGE
                  </T>
                )}
              </View>
            ))}
            {error && (
              <T v="body" style={{ color: color.ember }}>
                {error}
              </T>
            )}
          </View>
        )}

        {chapter.credits.length > 0 && (
          <T v="caption" style={{ paddingTop: 20 }}>
            {chapter.credits.map((c) => `${c.role}: ${c.name}`).join(' · ')}
          </T>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  status: { gap: 6, padding: 16, borderRadius: radius.md, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash, marginVertical: 8 },
  edition: { gap: 10, padding: 18, borderRadius: radius.md + 2, backgroundColor: color.char, borderWidth: 1 },
});
