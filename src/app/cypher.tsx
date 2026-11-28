import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { allChapters, commentCount, panelKey } from '@/content/catalog';
import { isReached } from '@/domain/position';
import { useFurthest } from '@/state/derived';
import { color } from '@/theme/tokens';
import { Back, Bubble, Lock } from '@/ui/icons';
import { IconButton, Row, T } from '@/ui/kit';

/** Cypher hub: every panel with a thread, grouped by chapter. Threads ahead of you stay sealed. */
export default function CypherHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const furthest = useFurthest('flame-sigil');

  const threads = allChapters().flatMap((ch) =>
    ch.pages.flatMap((p, pi) =>
      p.panels.map((panel, i) => ({
        key: panelKey(p, i),
        chapter: ch,
        pageLabel: p.label,
        panelId: panel.id,
        count: commentCount(panelKey(p, i)),
        reached: isReached({ chapter: ch.number, page: pi, panel: i }, furthest),
      })),
    ),
  ).filter((t) => t.count > 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: 24, paddingBottom: 40 }}>
      <View style={{ marginLeft: -16 }}>
        <IconButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Back />
        </IconButton>
      </View>
      <T v="kicker" style={{ color: color.storm }}>
        Panel-pinned threads
      </T>
      <T v="headline" style={{ fontSize: 32, lineHeight: 36, paddingTop: 6 }}>
        Cypher
      </T>
      <T v="body" style={{ paddingTop: 8, paddingBottom: 12 }}>
        Talk lives on the exact panel it’s about. Threads past where you’ve read stay sealed.
      </T>
      <T v="mono" style={{ fontSize: 10, color: color.storm, paddingBottom: 12 }}>
        SAMPLE DISCUSSION · POSTING OPENS WITH ACCOUNTS AND MODERATION
      </T>
      {threads.map((t) => (
        <Row
          key={t.key}
          onPress={t.reached ? () => router.push(`/thread/${encodeURIComponent(t.key)}`) : undefined}
          accessibilityRole={t.reached ? 'button' : 'text'}
          accessibilityLabel={t.reached ? `${t.count} reactions, chapter ${t.chapter.number}, page ${t.pageLabel}` : 'Sealed thread ahead of your reading position'}
          style={styles.row}
        >
          <View style={styles.icon}>{t.reached ? <Bubble /> : <Lock />}</View>
          <View style={{ flex: 1, gap: 3 }}>
            <T v="bodyStrong" style={{ color: t.reached ? color.bone : color.smoke }}>
              {t.reached ? `${t.chapter.title} · ${t.panelId.replace(/-/g, ' ')}` : 'Sealed thread'}
            </T>
            <T v="caption">
              Ch. {t.chapter.number} · page {t.pageLabel}
            </T>
          </View>
          <T v="mono" style={{ color: t.reached ? color.storm : color.smoke }}>
            {t.count}
          </T>
        </Row>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: color.char, alignItems: 'center', justifyContent: 'center' },
});
