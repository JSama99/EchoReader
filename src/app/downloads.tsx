import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { allChapters, getSeries, ledgerFor } from '@/content/catalog';
import { localKey } from '@/domain/library';
import { useReader } from '@/state/store';
import { color, radius } from '@/theme/tokens';
import { Back, Check } from '@/ui/icons';
import { IconButton, Row, T } from '@/ui/kit';

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/**
 * What reads offline on this device. Everything listed here is real: pages
 * bundled with the app and comics the reader imported. Remote chapter
 * downloads arrive with the content service and aren't simulated here.
 */
export default function Downloads() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const finished = useReader((s) => s.finishedChapterIds);
  const library = useReader((s) => s.library);

  const bundled = allChapters()
    .filter((c) => c.pages.length > 0)
    .map((c) => ({ c, bytes: (ledgerFor(c.id)?.pageBytes ?? []).reduce((a, b) => a + b, 0) }));
  const importedBytes = library.reduce((a, p) => a + p.sizeBytes, 0);
  const total = bundled.reduce((a, x) => a + x.bytes, 0) + importedBytes;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 32 }}>
      <View style={styles.nav}>
        <IconButton label="Back" onPress={() => router.back()}>
          <Back />
        </IconButton>
      </View>
      <View style={{ paddingHorizontal: 24, gap: 16 }}>
        <T v="headline" style={{ fontSize: 32, lineHeight: 36 }}>
          Offline
        </T>
        <View style={styles.card}>
          <T v="caption">Everything below reads without a connection.</T>
          <T v="mono" style={{ color: color.bone }}>
            {mb(total)} ON THIS DEVICE
          </T>
        </View>

        <T v="label">Included with the app</T>
        {bundled.map(({ c, bytes }) => (
          <Row key={c.id} style={styles.row} accessibilityLabel={`${c.label}, ${mb(bytes)}, available offline`}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="body" style={{ color: color.bone }}>
                {getSeries(c.seriesId)?.title} · {c.label} · {c.title}
              </T>
              <T v="caption" style={{ fontSize: 12 }}>
                {mb(bytes)} · {finished.includes(c.id) ? 'Read' : 'Unread'}
                {c.contentStatus === 'excerpt' ? ' · excerpt' : ''}
              </T>
            </View>
            <Check />
          </Row>
        ))}

        <T v="label" style={{ paddingTop: 8 }}>
          Your imported comics
        </T>
        {library.length === 0 ? (
          <T v="caption">None yet. Import PDF, CBZ or image files from the Library tab.</T>
        ) : (
          library.map((p) => (
            <Row key={p.id} style={styles.row} onPress={() => router.push(`/read/${encodeURIComponent(localKey(p.id))}`)} accessibilityLabel={`${p.title}, ${mb(p.sizeBytes)}`}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="body" style={{ color: color.bone }} numberOfLines={1}>
                  {p.title}
                </T>
                <T v="caption" style={{ fontSize: 12 }}>
                  {p.format.toUpperCase()} · {p.pages.length} pages · {mb(p.sizeBytes)}
                </T>
              </View>
              <Check />
            </Row>
          ))
        )}

        <T v="caption" style={{ paddingTop: 8 }}>
          Chapters released after this version of the app will download from the content service, which isn’t live yet.
        </T>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nav: { paddingHorizontal: 8 },
  card: { gap: 8, padding: 16, borderRadius: radius.md, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash },
  row: { minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
});
