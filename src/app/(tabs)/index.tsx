import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSeries, series } from '@/content/catalog';
import { coverImages } from '@/content/images';
import { toRoman } from '@/domain/fragments';
import { MODE_LABEL, resolveMode } from '@/domain/reading-mode';
import { continueFor, useFragments } from '@/state/derived';
import { useReader } from '@/state/store';
import { color, radius } from '@/theme/tokens';
import { Download, FlameMark, Search } from '@/ui/icons';
import { Button, Diamonds, IconButton, ProgressBar, T } from '@/ui/kit';
import { PowSeal, useVerification } from '@/ui/pow-seal';

export default function Library() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const state = useReader((s) => s);
  const fs = getSeries('flame-sigil')!;
  const cont = continueFor(state, fs.id);
  const frags = useFragments(fs.id);
  const verify = useVerification(cont?.chapter.id);
  const mode = resolveMode(fs, state.seriesModes, state.globalMode);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: 32 }}>
      <View style={styles.top}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <FlameMark />
          <T v="title">EchoReader</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton label="Search" onPress={() => router.push('/discover')}>
            <Search />
          </IconButton>
          <Link href="/profile" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Profile" style={styles.avatar}>
              <T v="bodyStrong" style={{ fontSize: 12 }}>
                ME
              </T>
            </Pressable>
          </Link>
        </View>
      </View>

      {cont && (
        <View style={{ paddingHorizontal: 24 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${fs.title}`}
            onPress={() => router.push(`/series/${fs.id}`)}
            style={styles.cover}
          >
            <Image source={coverImages[fs.id]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={200} />
            <LinearGradient colors={['rgba(11,10,9,0)', 'rgba(11,10,9,0.92)', color.soot]} locations={[0, 0.7, 1]} style={styles.coverFade} />
            <View style={styles.coverText}>
              <T v="kicker">Continue · Chapter {cont.chapter.number}</T>
              <T v="bodyStrong" style={{ color: color.bone }}>
                {cont.chapter.title} · page {cont.pageLabel}
              </T>
              <ProgressBar value={cont.progress} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.seal}>
              <PowSeal result={verify} />
            </View>
          </Pressable>

          <View style={styles.resumeRow}>
            <Button
              label={`Resume in ${MODE_LABEL[mode]}`}
              style={{ flex: 1 }}
              onPress={() => router.push(`/read/${cont.chapter.id}`)}
            />
            <IconButton label="Downloads" onPress={() => router.push('/downloads')} style={styles.round}>
              <Download />
            </IconButton>
          </View>

          <View style={styles.fragments}>
            <View style={{ gap: 4 }}>
              <T v="bodyStrong">Nine Fragments</T>
              <T v="caption">
                {frags.count} found
                {frags.next ? ` · next: Fragment ${toRoman(frags.next.ordinal)}` : frags.count < 9 ? ' · more arrive with new chapters' : ''}
              </T>
            </View>
            <Diamonds count={frags.count} />
          </View>
        </View>
      )}

      <View style={{ paddingTop: 28, gap: 12 }}>
        <View style={[styles.sectionHead, { paddingHorizontal: 24 }]}>
          <T v="title">The Echoverse</T>
          <Link href="/discover" style={{ color: color.smoke, fontSize: 13 }}>
            See all
          </Link>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}>
          {series.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}. ${s.status === 'live' ? 'Available' : s.releaseLabel}`}
              onPress={() => (s.status === 'live' ? router.push(`/series/${s.id}`) : router.push('/discover'))}
              style={styles.shelf}
            >
              {coverImages[s.id] ? (
                <Image source={coverImages[s.id]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
              ) : (
                <LinearGradient
                  colors={s.id === 'echo-state' ? ['#1C2638', '#0E1118'] : ['#2A1E10', '#0E0B08']}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <LinearGradient colors={['rgba(11,10,9,0.85)', 'rgba(11,10,9,0)']} style={styles.shelfFade} />
              <T v="title" style={{ fontSize: 13, lineHeight: 15, padding: 10 }} numberOfLines={2}>
                {s.title.toUpperCase()}
              </T>
              {s.status !== 'live' && (
                <View style={styles.shelfBadge}>
                  <T v="mono" style={{ fontSize: 9, color: s.id === 'flame-sigil-origin' ? color.glyph : color.storm }}>
                    {(s.releaseLabel ?? '').toUpperCase()}
                  </T>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 16, paddingBottom: 12 },
  avatar: { width: 32, height: 32, marginLeft: 4, borderRadius: radius.full, borderWidth: 1.5, borderColor: color.ash, backgroundColor: color.char, alignItems: 'center', justifyContent: 'center' },
  cover: { height: 360, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.char },
  coverFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 170 },
  coverText: { position: 'absolute', left: 20, right: 20, bottom: 18, gap: 6 },
  seal: { position: 'absolute', right: 14, bottom: 74 },
  resumeRow: { flexDirection: 'row', gap: 14, paddingTop: 16, alignItems: 'center' },
  round: { width: 52, height: 52, borderRadius: radius.full, borderWidth: 1.5, borderColor: color.ash },
  fragments: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  shelf: { width: 118, height: 156, borderRadius: 10, overflow: 'hidden', backgroundColor: color.char },
  shelfFade: { position: 'absolute', left: 0, right: 0, top: 0, height: 70 },
  shelfBadge: { position: 'absolute', left: 8, bottom: 8, paddingVertical: 3, paddingHorizontal: 7, borderRadius: radius.full, backgroundColor: 'rgba(11,10,9,0.75)' },
});
