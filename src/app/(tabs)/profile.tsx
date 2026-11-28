import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { allEditions, getChapter, getSeries } from '@/content/catalog';
import { formatMoney } from '@/domain/commerce/ledger';
import type { ReadingMode } from '@/domain/types';
import { chapterName } from '@/domain/library';
import { queued } from '@/services/analytics';
import { commerce } from '@/services/commerce';
import { accountsStatus } from '@/services/identity';
import { deleteAllPublicationFiles } from '@/services/page-store';
import { useEmbers, useFragments } from '@/state/derived';
import { useDispatch, useReader } from '@/state/store';
import { color, radius } from '@/theme/tokens';
import { Ember } from '@/ui/icons';
import { Button, Segmented, T, Toggle } from '@/ui/kit';

/** Account, reading preferences, accessibility, purchases, privacy, sync. */
export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const s = useReader((st) => st);
  const embers = useEmbers();
  const frags = useFragments('flame-sigil');
  const [confirmErase, setConfirmErase] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const txs = [...s.commerce.transactions].reverse();

  const restore = async () => {
    setRestoring('Checking…');
    const found = await commerce.restore(s.commerce.transactions);
    dispatch({ type: 'applyTransactions', transactions: found, editions: allEditions() });
    setRestoring(commerce.available ? `${found.length} purchase${found.length === 1 ? '' : 's'} checked` : 'Purchases aren’t available in this build yet');
  };

  const erase = async () => {
    await deleteAllPublicationFiles();
    dispatch({ type: 'eraseAll' });
    router.replace('/onboarding');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 40, paddingHorizontal: 24, gap: 26 }}>
      <T v="headline" style={{ fontSize: 32, lineHeight: 36 }}>
        You
      </T>

      <View style={styles.card}>
        <T v="bodyStrong">Guest reader</T>
        <T v="caption">
          Everything works without an account: reading, imports, progress and Embers are saved on this{' '}
          {Platform.OS === 'web' ? 'browser' : 'device'}.{' '}
          {accountsStatus === 'not-configured'
            ? 'Accounts with cross-device sync and purchase restore aren’t available in this build yet.'
            : 'Accounts are configured but not yet connected in this build.'}
        </T>
      </View>

      <View style={styles.stats}>
        <Stat value={String(s.finishedChapterIds.filter((id) => !id.startsWith('local:')).length)} label="Chapters read" />
        <Stat value={`${frags.count}/9`} label="Fragments" tone={color.glyph} border />
        <Stat value={String(embers)} label="Embers" icon border />
      </View>

      <Section title="Reading">
        <View style={{ gap: 10, paddingBottom: 8 }}>
          <T v="caption">Default reading mode</T>
          <Segmented<ReadingMode>
            value={s.globalMode ?? 'sigil'}
            onChange={(m) => dispatch({ type: 'set', patch: { globalMode: m } })}
            options={[
              { key: 'sigil', label: 'Sigil View' },
              { key: 'scroll', label: 'Scroll' },
              { key: 'pages', label: 'Pages' },
            ]}
          />
          <T v="caption" style={{ fontSize: 12 }}>
            Sigil View is used only for publications with authored panels. Imported comics open in Pages or Scroll.
            {Object.keys(s.seriesModes).length > 0 ? ` Overridden for: ${Object.keys(s.seriesModes).map((id) => getSeries(id)?.title ?? id).join(', ')}.` : ''}
          </T>
        </View>
        <SettingRow label="Page fit" sub="Pages mode">
          <View style={{ width: 200 }}>
            <Segmented value={s.fit} onChange={(f) => dispatch({ type: 'set', patch: { fit: f } })} options={[{ key: 'page', label: 'Page' }, { key: 'width', label: 'Width' }, { key: 'height', label: 'Height' }]} />
          </View>
        </SettingRow>
        <SettingRow label="Reading background">
          <View style={{ width: 150 }}>
            <Segmented value={s.readerTheme} onChange={(t) => dispatch({ type: 'set', patch: { readerTheme: t } })} options={[{ key: 'dark', label: 'Dark' }, { key: 'light', label: 'Light' }]} />
          </View>
        </SettingRow>
        <SettingRow label="Echo Layer glyphs" sub="On publications that include them">
          <Toggle label="Echo Layer glyphs" tone="glyph" value={s.echoEnabled} onChange={(v) => dispatch({ type: 'set', patch: { echoEnabled: v } })} />
        </SettingRow>
        <SettingRow label="Panel transition" sub="Sigil View camera">
          <View style={{ width: 150 }}>
            <Segmented value={s.transition} onChange={(t) => dispatch({ type: 'set', patch: { transition: t } })} options={[{ key: 'glide', label: 'Glide' }, { key: 'cut', label: 'Cut' }]} />
          </View>
        </SettingRow>
        <SettingRow label="Spoiler Shield" sub="Codex, fragments and discussion never show past your furthest panel" last>
          <T v="mono" style={{ color: color.bone }}>
            ALWAYS ON
          </T>
        </SettingRow>
      </Section>

      <Section title="Accessibility">
        <SettingRow label="Motion" sub="System follows your device’s Reduce Motion setting; Reduce cuts between panels" last>
          <View style={{ width: 200 }}>
            <Segmented value={s.motion} onChange={(m) => dispatch({ type: 'set', patch: { motion: m } })} options={[{ key: 'system', label: 'System' }, { key: 'reduce', label: 'Reduce' }, { key: 'full', label: 'Full' }]} />
          </View>
        </SettingRow>
      </Section>

      <Section title="Purchases">
        <T v="caption" style={{ paddingBottom: 8 }}>
          {commerce.kind === 'sandbox'
            ? 'This build uses sandbox purchases: no money changes hands, and sandbox editions are labeled everywhere they appear.'
            : 'Chapter purchases open when EchoReader launches in the App Store and Google Play.'}
        </T>
        {txs.length === 0 && <T v="caption">No purchases yet.</T>}
        {txs.map((tx) => {
          const ch = getChapter(tx.chapterId);
          const ed = allEditions().find((e) => e.id === tx.editionId);
          return (
            <View key={tx.id} style={styles.txRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="body" style={{ color: color.bone }} numberOfLines={1}>
                  {ch ? chapterName(ch) : tx.chapterId}
                </T>
                <T v="mono" style={{ fontSize: 10 }}>
                  {(ed?.title ?? tx.editionId).toUpperCase()} · {formatMoney(tx.amount)} · {tx.status.toUpperCase()}
                  {tx.environment === 'sandbox' ? ' · SANDBOX' : ''}
                </T>
              </View>
              {commerce.refund && tx.status === 'completed' && tx.environment === 'sandbox' && (
                <Button
                  kind="ghost"
                  label="Refund"
                  onPress={async () => dispatch({ type: 'applyTransactions', transactions: [await commerce.refund!(tx)], editions: allEditions() })}
                />
              )}
            </View>
          );
        })}
        <Button kind="ghost" label="Restore purchases" onPress={restore} style={{ marginTop: 10 }} />
        {restoring && (
          <T v="caption" style={{ paddingTop: 6 }}>
            {restoring}
          </T>
        )}
      </Section>

      <Section title="Embers">
        <View style={styles.note}>
          <Ember size={20} />
          <T v="caption" style={{ flex: 1 }}>
            Embers are rewards for reading: finishing chapters, discovering Echo Layer glyphs, completing collections. They can’t be bought, sold, sent to
            anyone or exchanged for money, and they don’t unlock paid chapters unless a publisher offers that for a specific chapter.
          </T>
        </View>
      </Section>

      <Section title="Privacy">
        <SettingRow label="Share anonymous usage" sub="Off by default. Never includes your imported comics’ names or files.">
          <Toggle label="Share anonymous usage" value={s.analyticsConsent} onChange={(v) => dispatch({ type: 'set', patch: { analyticsConsent: v } })} />
        </SettingRow>
        <SettingRow label="Collected this session" sub="No analytics service is configured in this build, so nothing is sent." last>
          <Button kind="ghost" label={showEvents ? 'Hide' : `${queued().length} events`} onPress={() => setShowEvents((v) => !v)} />
        </SettingRow>
        {showEvents && (
          <View style={styles.events}>
            {queued().length === 0 ? (
              <T v="caption">Nothing collected.</T>
            ) : (
              queued()
                .slice(-30)
                .map((e, i) => (
                  <T key={i} v="mono" style={{ fontSize: 10 }}>
                    {e.name} {JSON.stringify(e.props)}
                    {e.synthetic ? ' · synthetic' : ''}
                  </T>
                ))
            )}
          </View>
        )}
        <T v="caption" style={{ paddingTop: 12 }}>
          Imported comics stay on this device. EchoReader never uploads them.
        </T>
      </Section>

      <Section title="Data on this device">
        {!confirmErase ? (
          <Button kind="ghost" label="Erase all EchoReader data…" onPress={() => setConfirmErase(true)} />
        ) : (
          <View style={{ gap: 10 }}>
            <T v="body" style={{ color: color.bone }}>
              This removes your imported comics, progress, bookmarks, collections, Embers and sandbox purchases from this device. It can’t be undone.
            </T>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button kind="ghost" label="Cancel" style={{ flex: 1 }} onPress={() => setConfirmErase(false)} />
              <Button label="Erase everything" style={{ flex: 1 }} onPress={erase} />
            </View>
          </View>
        )}
      </Section>

      <Button
        kind="ghost"
        label="Replay onboarding"
        onPress={() => {
          dispatch({ type: 'resetOnboarding' });
          router.replace('/onboarding');
        }}
      />
      <T v="mono" style={{ textAlign: 'center', fontSize: 11 }}>
        ECHOREADER {Constants.expoConfig?.version ?? ''} · BEYOND THE PAGE · TALONSIGHT TECHNOLOGIES
      </T>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <T v="label" style={{ paddingBottom: 6 }}>
        {title}
      </T>
      {children}
    </View>
  );
}

function Stat({ value, label, tone, icon, border }: { value: string; label: string; tone?: string; icon?: boolean; border?: boolean }) {
  return (
    <View style={[{ flex: 1, gap: 4 }, border && { paddingLeft: 16, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: color.ash }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon && <Ember size={16} />}
        <T v="headline" style={{ fontSize: 26, color: tone ?? color.bone }}>
          {value}
        </T>
      </View>
      <T v="caption" style={{ fontSize: 12 }}>
        {label}
      </T>
    </View>
  );
}

function SettingRow({ label, sub, children, last }: { label: string; sub?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.setRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body" style={{ color: color.bone }}>
          {label}
        </T>
        {sub && (
          <T v="caption" style={{ fontSize: 12 }}>
            {sub}
          </T>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6, padding: 16, borderRadius: radius.md, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash },
  stats: { flexDirection: 'row' },
  note: { flexDirection: 'row', gap: 14, padding: 16, borderRadius: radius.md + 2, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: 12, paddingVertical: 6 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
  events: { gap: 4, padding: 12, borderRadius: radius.sm, backgroundColor: color.char, marginTop: 8 },
});
