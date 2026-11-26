import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSeries } from '@/content/catalog';
import type { ReadingMode } from '@/domain/types';
import { useFragments } from '@/state/derived';
import { useDispatch, useReader } from '@/state/store';
import { color, radius } from '@/theme/tokens';
import { Back, Ember } from '@/ui/icons';
import { Button, IconButton, Segmented, T, Toggle } from '@/ui/kit';

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const s = useReader((st) => st);
  const frags = useFragments('flame-sigil');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 32 }}>
      <View style={{ paddingHorizontal: 8 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <Back />
        </IconButton>
      </View>
      <View style={{ paddingHorizontal: 24, gap: 24 }}>
        <T v="headline" style={{ fontSize: 32, lineHeight: 36 }}>
          You
        </T>

        <View style={styles.stats}>
          <Stat value={String(s.finishedChapterIds.length)} label="Chapters read" />
          <Stat value={`${frags.count}/9`} label="Fragments" tone={color.glyph} border />
          <Stat value={String(s.embers)} label="Embers" icon border />
        </View>

        <View style={styles.note}>
          <Ember size={20} />
          <View style={{ flex: 1, gap: 4 }}>
            <T v="bodyStrong" style={{ fontSize: 14 }}>
              Embers unlock early chapters
            </T>
            <T v="caption">You earn one each week you finish a chapter. Every early chapter is free for all within 24 hours.</T>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <T v="label">Default reading mode</T>
          <Segmented<ReadingMode>
            value={s.globalMode ?? 'sigil'}
            onChange={(m) => dispatch({ type: 'set', patch: { globalMode: m } })}
            options={[
              { key: 'sigil', label: 'Sigil View' },
              { key: 'scroll', label: 'Scroll' },
              { key: 'pages', label: 'Pages' },
            ]}
          />
          {Object.keys(s.seriesModes).length > 0 && (
            <T v="caption" style={{ fontSize: 12 }}>
              Overridden for: {Object.keys(s.seriesModes).map((id) => getSeries(id)?.title ?? id).join(', ')}
            </T>
          )}
        </View>

        <View>
          <T v="label" style={{ paddingBottom: 4 }}>
            Reading
          </T>
          <SettingRow label="Echo Layer glyphs" sub="Tap glowing glyphs to open the Codex">
            <Toggle label="Echo Layer glyphs" tone="glyph" value={s.echoEnabled} onChange={(v) => dispatch({ type: 'set', patch: { echoEnabled: v } })} />
          </SettingRow>
          <SettingRow label="Panel transition" sub="Sigil View camera movement">
            <View style={{ width: 150 }}>
              <Segmented
                value={s.transition}
                onChange={(t) => dispatch({ type: 'set', patch: { transition: t } })}
                options={[
                  { key: 'glide', label: 'Glide' },
                  { key: 'cut', label: 'Cut' },
                ]}
              />
            </View>
          </SettingRow>
          <SettingRow label="Spoiler shield" sub="Codex and Cypher never show past your furthest panel" last>
            <T v="mono" style={{ color: color.bone }}>
              ALWAYS ON
            </T>
          </SettingRow>
        </View>

        <View style={{ gap: 6 }}>
          <T v="label">This device</T>
          <T v="caption">
            Progress is saved on this {Platform.OS === 'ios' ? 'iPhone or iPad' : Platform.OS === 'android' ? 'Android device' : 'browser'}. Cross-device sync
            arrives with EchoReader accounts.
          </T>
        </View>

        <Button kind="ghost" label="Replay onboarding" onPress={() => {
          dispatch({ type: 'resetOnboarding' });
          router.replace('/onboarding');
        }} />
        <T v="mono" style={{ textAlign: 'center', fontSize: 11 }}>
          ECHOREADER {Constants.expoConfig?.version ?? ''} · TALONSIGHT TECHNOLOGIES
        </T>
      </View>
    </ScrollView>
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
  stats: { flexDirection: 'row' },
  note: { flexDirection: 'row', gap: 14, padding: 16, borderRadius: radius.md + 2, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: 12 },
});
