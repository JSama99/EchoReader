import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chapters, getEntry } from '@/content/catalog';
import { portraitImages } from '@/content/images';
import { isEntryDiscovered, shieldEntry } from '@/domain/spoilers';
import { useFurthest } from '@/state/derived';
import { color, radius } from '@/theme/tokens';
import { Back, Lock } from '@/ui/icons';
import { Button, Chip, IconButton, Row, T } from '@/ui/kit';

export default function CodexEntryScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const entry = getEntry(id);
  const furthest = useFurthest(entry?.seriesId ?? 'flame-sigil');

  // Never render an entry the reader hasn't reached, even via a deep link.
  if (!entry || !isEntryDiscovered(entry, furthest)) return <Redirect href="/codex" />;

  const s = shieldEntry(entry, furthest);
  const portrait = portraitImages[entry.id];
  const firstChapter = chapters.find((c) => c.number === entry.firstSeen.chapter && c.seriesId === entry.seriesId);
  const firstPage = firstChapter?.pages[entry.firstSeen.page];
  const bonds = (entry.bondIds ?? []).map(getEntry).filter((b) => b && isEntryDiscovered(b, furthest));

  return (
    <View style={{ flex: 1, backgroundColor: color.soot }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ height: portrait ? 430 : 220 }}>
          {portrait ? (
            <Image source={portrait} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityLabel={`Portrait of ${entry.name}`} />
          ) : (
            <LinearGradient colors={['rgba(233,180,76,0.28)', 'rgba(233,180,76,0)']} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient colors={['rgba(11,10,9,0.85)', 'rgba(11,10,9,0)']} style={[styles.fade, { top: 0, height: 120 }]} />
          <LinearGradient colors={['rgba(11,10,9,0)', 'rgba(11,10,9,0.85)', color.soot]} locations={[0, 0.55, 1]} style={[styles.fade, { bottom: 0, height: 220 }]} />
          <View style={[styles.nav, { paddingTop: insets.top }]}>
            <IconButton label="Back" onPress={() => router.back()}>
              <Back />
            </IconButton>
            <T v="kicker" style={{ color: color.glyph }}>
              Codex · {entry.kind}
            </T>
            <View style={{ width: 44 }} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 10, marginTop: -120 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {entry.tags.map((t, i) => (
              <Chip key={t} label={t} tone={i === 0 ? 'ember' : 'bone'} style={{ backgroundColor: 'rgba(11,10,9,0.75)' }} />
            ))}
          </View>
          <T v="display" style={{ fontSize: 44, lineHeight: 44 }}>
            {entry.name.toUpperCase().replace(' ', '\n')}
          </T>
          <T v="mono">
            FIRST SEEN CH. {entry.firstSeen.chapter} · PAGE {firstPage?.label ?? entry.firstSeen.page + 1}
          </T>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T v="label">What you know so far</T>
            <T v="mono" style={{ color: color.glyph }}>
              {s.visibleLines.length} / {entry.lines.length} LINES
            </T>
          </View>
          {s.visibleLines.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 2, backgroundColor: color.ember }} />
              <T v="body" style={{ flex: 1, color: color.bone }}>
                {line}
              </T>
            </View>
          ))}
          {s.sealedCount > 0 && (
            <View style={styles.sealed} accessibilityLabel={`${s.sealedCount} sealed lines`}>
              <Lock />
              <T v="caption">
                Sealed{s.nextReveal ? ` until Ch. ${s.nextReveal.chapter}` : ''} · {s.sealedCount} {s.sealedCount === 1 ? 'line' : 'lines'}
              </T>
            </View>
          )}
        </View>

        {bonds.length > 0 && (
          <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 6 }}>
            <T v="label">Bonds</T>
            {bonds.map((b) => (
              <Row key={b!.id} onPress={() => router.push(`/codex/${b!.id}`)} accessibilityRole="button" style={{ minHeight: 52 }}>
                <View style={[styles.dot, { backgroundColor: b!.tags[0]?.includes('Storm') ? color.storm : color.ember }]} />
                <T v="bodyStrong" style={{ flex: 1 }}>
                  {b!.name}
                </T>
                <T v="caption">{b!.tags[0]}</T>
              </Row>
            ))}
          </View>
        )}
      </ScrollView>

      {firstChapter && (
        <View style={[styles.cta, { bottom: insets.bottom + 16 }]}>
          <Button kind="glyph" label="Revisit first appearance" onPress={() => router.push(`/read/${firstChapter.id}`)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  sealed: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: color.char, borderWidth: 1, borderStyle: 'dashed', borderColor: color.ash },
  dot: { width: 28, height: 28, borderRadius: radius.full },
  cta: { position: 'absolute', left: 24, right: 24 },
});
