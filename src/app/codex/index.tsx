import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { codex } from '@/content/catalog';
import { toRoman } from '@/domain/fragments';
import { discoveredEntries, shieldEntry } from '@/domain/spoilers';
import { useFragments, useFurthest } from '@/state/derived';
import { color } from '@/theme/tokens';
import { Back } from '@/ui/icons';
import { Diamonds, IconButton, Row, T } from '@/ui/kit';

const KIND_LABEL = { character: 'Characters', glyph: 'Glyphs', lore: 'Lore', place: 'Places' } as const;

export default function CodexIndex() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const furthest = useFurthest('flame-sigil');
  const frags = useFragments('flame-sigil');
  const entries = discoveredEntries(codex, furthest);
  const hidden = codex.length - entries.length;
  const kinds = (['character', 'glyph', 'lore', 'place'] as const).filter((k) => entries.some((e) => e.kind === k));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 40, paddingHorizontal: 24 }}>
      <View style={{ marginLeft: -16 }}>
        <IconButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Back />
        </IconButton>
      </View>
      <T v="kicker" style={{ color: color.glyph }}>
        Akasha’s record
      </T>
      <T v="headline" style={{ fontSize: 32, lineHeight: 36, paddingTop: 6 }}>
        Codex
      </T>
      <T v="body" style={{ paddingTop: 8 }}>
        Everything here is shown only as far as you’ve read.
      </T>

      <View style={styles.frag}>
        <View style={{ gap: 4 }}>
          <T v="bodyStrong">Nine Fragments</T>
          <T v="caption">
            {frags.found.length > 0 ? frags.found.map((f) => `${toRoman(f.ordinal)} · ${f.title}`).join('\n') : 'None found yet'}
          </T>
        </View>
        <Diamonds count={frags.count} size={10} />
      </View>

      {entries.length === 0 && (
        <T v="caption" style={{ paddingTop: 24 }}>
          Start reading Flame Sigil. Entries appear here as you meet them.
        </T>
      )}

      {kinds.map((k) => (
        <View key={k} style={{ paddingTop: 24 }}>
          <T v="label" style={{ paddingBottom: 4 }}>
            {KIND_LABEL[k]}
          </T>
          {entries
            .filter((e) => e.kind === k)
            .map((e) => {
              const s = shieldEntry(e, furthest);
              return (
                <Row key={e.id} onPress={() => router.push(`/codex/${e.id}`)} accessibilityRole="button" style={styles.row}>
                  <View style={styles.diamond} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <T v="bodyStrong">{e.name}</T>
                    <T v="caption" numberOfLines={1}>
                      {e.tags.join(' · ')}
                    </T>
                  </View>
                  <T v="mono" style={{ color: s.sealedCount ? color.smoke : color.glyph }}>
                    {s.visibleLines.length}/{e.lines.length}
                  </T>
                </Row>
              );
            })}
        </View>
      ))}

      {hidden > 0 && (
        <T v="caption" style={{ paddingTop: 24 }}>
          {hidden} {hidden === 1 ? 'entry is' : 'entries are'} still sealed ahead of you.
        </T>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  frag: { marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  row: { minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
  diamond: { width: 10, height: 10, transform: [{ rotate: '45deg' }], backgroundColor: color.glyph },
});
