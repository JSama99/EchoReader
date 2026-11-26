import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chapters, getSeries, ledgerFor } from '@/content/catalog';
import { useDispatch, useReader } from '@/state/store';
import { color, radius } from '@/theme/tokens';
import { Back, Check } from '@/ui/icons';
import { IconButton, Row, Segmented, T, Toggle } from '@/ui/kit';

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

export default function Downloads() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const keepNext = useReader((s) => s.keepNextChapters);
  const clearAfter = useReader((s) => s.clearAfterDays);
  const finished = useReader((s) => s.finishedChapterIds);

  const offline = chapters
    .filter((c) => c.pages.length > 0)
    .map((c) => ({ c, bytes: (ledgerFor(c.id)?.pageBytes ?? []).reduce((a, b) => a + b, 0) }));
  const total = offline.reduce((a, x) => a + x.bytes, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 32 }}>
      <View style={styles.nav}>
        <IconButton label="Back" onPress={() => router.back()}>
          <Back />
        </IconButton>
      </View>
      <View style={{ paddingHorizontal: 24, gap: 16 }}>
        <T v="headline" style={{ fontSize: 32, lineHeight: 36 }}>
          Downloads
        </T>
        <View style={{ gap: 8 }}>
          <View style={styles.bar}>
            <View style={{ flex: Math.max(1, total), backgroundColor: color.ember }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T v="caption" style={{ fontSize: 12 }}>
              Pages, Codex and verification data
            </T>
            <T v="mono" style={{ color: color.bone }}>
              {mb(total)}
            </T>
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.setRow, styles.divider]}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="body" style={{ color: color.bone }}>
                Keep the next 3 chapters ready
              </T>
              <T v="caption" style={{ fontSize: 12 }}>
                On Wi-Fi, for series you follow
              </T>
            </View>
            <Toggle label="Keep the next 3 chapters ready" value={keepNext} onChange={(v) => dispatch({ type: 'set', patch: { keepNextChapters: v } })} />
          </View>
          <View style={{ gap: 10, paddingVertical: 14 }}>
            <T v="body" style={{ color: color.bone }}>
              Clear chapters after reading
            </T>
            <Segmented
              value={String(clearAfter)}
              onChange={(k) => dispatch({ type: 'set', patch: { clearAfterDays: k === 'null' ? null : (Number(k) as 0 | 1 | 7) } })}
              options={[
                { key: '0', label: 'Now' },
                { key: '1', label: '1 day' },
                { key: '7', label: '7 days' },
                { key: 'null', label: 'Never' },
              ]}
            />
          </View>
        </View>

        <View>
          {offline.map(({ c, bytes }) => (
            <Row key={c.id} style={styles.row} accessibilityLabel={`Chapter ${c.number}, ${mb(bytes)}, available offline`}>
              <T v="mono" style={{ width: 28, fontSize: 13, color: color.bone }}>
                {c.number}
              </T>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="body" style={{ color: color.bone }}>
                  {getSeries(c.seriesId)?.title} · {c.title}
                </T>
                <T v="caption" style={{ fontSize: 12 }}>
                  {mb(bytes)} · {finished.includes(c.id) ? 'Read' : 'Unread'} · bundled with this edition
                </T>
              </View>
              <Check />
            </Row>
          ))}
        </View>
        <T v="caption">
          This edition ships Chapter 1 inside the app, so it reads offline from first launch. Chapters published later download
          over the content service and follow the rules above.
        </T>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nav: { paddingHorizontal: 8 },
  bar: { height: 8, borderRadius: radius.full, overflow: 'hidden', flexDirection: 'row', backgroundColor: color.ash },
  card: { borderRadius: 16, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash, paddingHorizontal: 16 },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 64, gap: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
  row: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
});
