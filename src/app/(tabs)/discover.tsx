import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chaptersOf, codex, series } from '@/content/catalog';
import { coverImages } from '@/content/images';
import { discoveredEntries } from '@/domain/spoilers';
import { useFragments, furthestOf } from '@/state/derived';
import { useDispatch, useReader } from '@/state/store';
import { color, font, radius } from '@/theme/tokens';
import { Search } from '@/ui/icons';
import { Button, Chip, Row, T } from '@/ui/kit';

export default function Discover() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useDispatch();
  const state = useReader((s) => s);
  const [q, setQ] = useState('');
  const frags = useFragments('flame-sigil');

  const query = q.trim().toLowerCase();
  // Search only what the reader is allowed to know: titles plus discovered Codex entries.
  const known = discoveredEntries(codex, furthestOf(state, 'flame-sigil'));
  const seriesHits = series.filter((s) => !query || s.title.toLowerCase().includes(query) || s.tagline.toLowerCase().includes(query));
  const codexHits = query ? known.filter((e) => e.name.toLowerCase().includes(query) || e.tags.some((t) => t.toLowerCase().includes(query))) : [];
  const echoState = series.find((s) => s.id === 'echo-state')!;
  const notify = state.notifySeries.includes(echoState.id);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={{ paddingHorizontal: 24, gap: 16 }}>
        <T v="headline" style={{ fontSize: 32, lineHeight: 34 }}>
          Discover
        </T>
        <View style={styles.search}>
          <Search size={18} color={color.smoke} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Titles, characters, glyphs…"
            placeholderTextColor={color.smoke}
            style={styles.input}
            accessibilityLabel="Search"
            returnKeyType="search"
          />
        </View>
      </View>

      {!query && (
        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <View style={styles.feature}>
            <LinearGradient colors={['#1C2638', '#0B0E16']} style={StyleSheet.absoluteFill} />
            <View style={{ position: 'absolute', left: 18, bottom: 18, right: 120, gap: 6 }}>
              <T v="kicker" style={{ color: color.storm }}>
                New series · {echoState.releaseLabel}
              </T>
              <T v="headline">ECHO STATE</T>
              <T v="caption" style={{ color: color.boneDim }}>
                {echoState.tagline}
              </T>
            </View>
            <Chip
              label={notify ? 'Notifying' : 'Notify me'}
              tone="storm"
              active={notify}
              onPress={() => dispatch({ type: 'toggleNotify', seriesId: echoState.id })}
              style={{ position: 'absolute', right: 14, top: 14 }}
            />
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: 24, paddingTop: 26 }}>
        <T v="title" style={{ paddingBottom: 6 }}>
          {query ? 'Series' : 'In the Echoverse'}
        </T>
        {seriesHits.length === 0 && <T v="caption">No series match “{q}”.</T>}
        {seriesHits.map((s) => {
          const live = s.status === 'live';
          const chs = chaptersOf(s.id).length;
          const following = state.following.includes(s.id);
          return (
            <Row
              key={s.id}
              onPress={live ? () => router.push(`/series/${s.id}`) : undefined}
              accessibilityRole={live ? 'button' : 'text'}
              style={styles.row}
            >
              <View style={styles.thumb}>
                {coverImages[s.id] ? (
                  <Image source={coverImages[s.id]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
                ) : (
                  <LinearGradient colors={s.id === 'echo-state' ? ['#1C2638', '#0E1118'] : ['#2A1E10', '#0E0B08']} style={StyleSheet.absoluteFill} />
                )}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <T v="bodyStrong">{s.title}</T>
                <T v="caption" style={{ color: s.id === 'flame-sigil-origin' ? color.glyph : color.smoke }}>
                  {live ? `${chs} chapters · new Fridays` : s.id === 'flame-sigil-origin' ? `Fragments ${frags.count}/9` : s.releaseLabel}
                </T>
              </View>
              {live && (
                <Button
                  kind={following ? 'ghost' : 'bone'}
                  label={following ? 'Following' : 'Follow'}
                  height={34}
                  style={{ paddingHorizontal: 14 }}
                  onPress={() => dispatch({ type: 'toggleFollow', seriesId: s.id })}
                />
              )}
            </Row>
          );
        })}
      </View>

      {codexHits.length > 0 && (
        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <T v="title" style={{ paddingBottom: 6 }}>
            Codex
          </T>
          {codexHits.map((e) => (
            <Row key={e.id} onPress={() => router.push(`/codex/${e.id}`)} accessibilityRole="button" style={styles.row}>
              <View style={[styles.thumb, styles.glyphThumb]}>
                <View style={styles.diamond} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <T v="bodyStrong">{e.name}</T>
                <T v="caption">{e.tags.join(' · ')}</T>
              </View>
            </Row>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash },
  input: { flex: 1, color: color.bone, fontFamily: font.ui, fontSize: 15, height: 46 },
  feature: { height: 200, borderRadius: radius.md, overflow: 'hidden' },
  row: { minHeight: 76, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
  thumb: { width: 44, height: 60, borderRadius: 6, overflow: 'hidden', backgroundColor: color.char },
  glyphThumb: { alignItems: 'center', justifyContent: 'center' },
  diamond: { width: 14, height: 14, transform: [{ rotate: '45deg' }], borderWidth: 1.5, borderColor: color.glyph },
});
