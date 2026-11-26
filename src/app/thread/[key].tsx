import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { allChapters, commentsFor, panelKey } from '@/content/catalog';
import { pageImages } from '@/content/images';
import { isReached } from '@/domain/position';
import { shieldComments, type ShieldedComment } from '@/domain/spoilers';
import { useFurthest } from '@/state/derived';
import { color, font, radius } from '@/theme/tokens';
import { Back, Ember, Lock } from '@/ui/icons';
import { Chip, IconButton, T } from '@/ui/kit';

type Sort = 'top' | 'newest' | 'creator';

export default function Thread() {
  const { key: raw = '' } = useLocalSearchParams<{ key?: string }>();
  const key = decodeURIComponent(raw);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const furthest = useFurthest('flame-sigil');
  const [sort, setSort] = useState<Sort>('top');
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState<string[]>([]);

  const loc = allChapters()
    .flatMap((ch) => ch.pages.flatMap((p, pi) => p.panels.map((pn, i) => ({ ch, p, pi, i, pn }))))
    .find((x) => panelKey(x.p, x.i) === key);
  if (!loc || !isReached({ chapter: loc.ch.number, page: loc.pi, panel: loc.i }, furthest)) return <Redirect href="/cypher" />;

  let list = shieldComments(commentsFor(key), furthest);
  if (sort === 'top') list = [...list].sort((a, b) => b.votes - a.votes);
  if (sort === 'newest') list = [...list].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (sort === 'creator') list = list.filter((c) => c.isCreator || c.replies?.some((r) => r.isCreator));

  const r = loc.pn.rect;
  const thumb = 56;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.soot }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <IconButton label="Back" onPress={() => router.back()}>
          <Back />
        </IconButton>
        {/* Thumbnail crops to the panel itself. */}
        <View style={styles.thumb}>
          <Image
            source={pageImages[loc.p.id]}
            style={{ position: 'absolute', width: thumb / r.w, height: (thumb / r.w) * (loc.p.height / loc.p.width), left: -(r.x * thumb) / r.w, top: -(r.y * (thumb / r.w) * (loc.p.height / loc.p.width)) + (thumb - (r.h * (thumb / r.w) * loc.p.height) / loc.p.width) / 2 }}
          />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <T v="bodyStrong" numberOfLines={1}>
            {loc.pn.id.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
          </T>
          <T v="mono" style={{ fontSize: 11 }}>
            CH. {loc.ch.number} · PAGE {loc.p.label} · PANEL {loc.i + 1}
          </T>
        </View>
      </View>

      <View style={styles.sorts}>
        {(['top', 'newest', 'creator'] as Sort[]).map((s) => (
          <Chip key={s} label={s === 'top' ? 'Top' : s === 'newest' ? 'Newest' : 'Creator'} tone={s === 'creator' ? 'ember' : 'bone'} active={sort === s} onPress={() => setSort(s)} />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 22 }}>
        {list.length === 0 && <T v="caption">No reactions here yet. Start the Cypher.</T>}
        {list.map((c) => (
          <Comment key={c.id} c={c} revealed={revealed} onReveal={(id) => setRevealed((r0) => [...r0, id])} />
        ))}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add to the Cypher…"
          placeholderTextColor={color.smoke}
          style={styles.input}
          accessibilityLabel="Write a reaction"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post"
          accessibilityHint="Posting arrives with the Cypher service"
          disabled
          style={[styles.send, { opacity: draft ? 0.6 : 0.3 }]}
        >
          <T v="bodyStrong" style={{ color: color.soot }}>
            ↑
          </T>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Comment({ c, revealed, onReveal, nested }: { c: ShieldedComment; revealed: string[]; onReveal: (id: string) => void; nested?: boolean }) {
  const folded = c.folded && !revealed.includes(c.id);
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={[styles.avatar, c.isCreator && { backgroundColor: '#3A2A1C' }, nested && { width: 26, height: 26 }]}>
        {c.isCreator ? <Ember size={12} /> : <T v="mono" style={{ color: color.bone, fontSize: 11 }}>{c.author[0]?.toUpperCase()}</T>}
      </View>
      <View style={[{ flex: 1, gap: 6 }, c.isCreator && styles.creator]}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <T v="bodyStrong" style={{ fontSize: 14 }}>
            {c.author}
          </T>
          {c.isCreator ? (
            <View style={styles.badge}>
              <T v="mono" style={{ fontSize: 10, color: color.soot }}>
                CREATOR
              </T>
            </View>
          ) : (
            c.tag && <T v="caption" style={{ fontSize: 12 }}>{c.tag}</T>
          )}
        </View>
        {folded ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Folded spoiler from a later chapter."
            accessibilityHint="Long press to reveal it anyway." onLongPress={() => onReveal(c.id)} style={styles.folded}>
            <Lock />
            <T v="caption">Mentions a later chapter. Folded until you read it.</T>
          </Pressable>
        ) : (
          <T v="body" style={{ color: color.bone }}>
            {c.body}
          </T>
        )}
        {!folded && (
          <T v="caption" style={{ fontSize: 12 }}>
            ▲ {c.votes >= 1000 ? `${(c.votes / 1000).toFixed(1)}k` : c.votes}
          </T>
        )}
        {c.replies?.map((r) => (
          <Comment key={r.id} c={r} revealed={revealed} onReveal={onReveal} nested />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
  thumb: { width: 56, height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: color.char, borderWidth: 1, borderColor: color.ash },
  sorts: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 14 },
  avatar: { width: 34, height: 34, borderRadius: radius.full, backgroundColor: color.ash, alignItems: 'center', justifyContent: 'center' },
  creator: { padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,91,31,0.07)', borderWidth: 1, borderColor: 'rgba(255,91,31,0.25)' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, backgroundColor: color.ember },
  folded: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: color.char, borderWidth: 1, borderStyle: 'dashed', borderColor: color.ash },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.ash },
  input: { flex: 1, height: 46, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash, color: color.bone, fontFamily: font.ui, fontSize: 15 },
  send: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: color.storm, alignItems: 'center', justifyContent: 'center' },
});
