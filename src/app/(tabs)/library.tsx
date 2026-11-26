import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getChapter, getSeries } from '@/content/catalog';
import { coverImages } from '@/content/images';
import { buildShelves, localKey, type ShelfItem } from '@/domain/library';
import { shelfItems } from '@/state/shelves';
import { track } from '@/services/analytics';
import { pickAndImport } from '@/services/importer';
import { useCatalogVersion } from '@/state/derived';
import type { ReaderState } from '@/state/model';
import { useDispatch, useReader } from '@/state/store';
import { color, font, radius } from '@/theme/tokens';
import { Download, Plus } from '@/ui/icons';
import { Button, Chip, IconButton, ProgressBar, Row, T } from '@/ui/kit';
import { LocalCover } from '@/ui/local-cover';

type Filter = 'all' | 'imported' | 'purchased' | 'favorites' | 'unread' | 'completed';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'imported', label: 'Imported' },
  { key: 'purchased', label: 'Purchased' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'unread', label: 'Unread' },
  { key: 'completed', label: 'Completed' },
];

export default function Library() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useDispatch();
  const state = useReader((s) => s);
  useCatalogVersion();
  const [filter, setFilter] = useState<Filter>('all');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const items = shelfItems(state);
  const shelves = buildShelves(items, state.collections);
  const activeCollection = shelves.collections.find((c) => c.collection.id === collectionId);
  const base = activeCollection
    ? activeCollection.items
    : filter === 'all'
      ? items
      : { imported: shelves.imported, purchased: shelves.purchased, favorites: shelves.favorites, unread: shelves.unread, completed: shelves.completed }[filter];

  const open = (it: ShelfItem) => router.push(it.kind === 'local' ? `/publication/${it.key.slice('local:'.length)}` : `/series/${it.key}`);

  const runImport = async () => {
    setNotice(null);
    setImporting({ done: 0, total: 0 });
    const r = await pickAndImport((done, total) => setImporting({ done, total }));
    setImporting(null);
    if (r.status === 'imported') {
      dispatch({ type: 'addPublication', publication: r.outcome.publication });
      track({ name: 'import_complete', format: r.outcome.publication.format, pages: r.outcome.publication.pages.length });
      const skipped = r.outcome.skipped ? ` ${r.outcome.skipped} file${r.outcome.skipped === 1 ? ' wasn’t an image and was' : 's weren’t images and were'} skipped.` : '';
      setNotice({ tone: 'ok', text: `Imported “${r.outcome.publication.title}” · ${r.outcome.publication.pages.length} pages.${skipped}` });
    } else if (r.status === 'failed') {
      track({ name: 'import_failed', code: r.code });
      setNotice({ tone: 'error', text: r.message });
    }
  };

  const bookmarks = state.bookmarks.slice(0, 12);
  const history = state.history.slice(0, 12);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <T v="headline" style={{ fontSize: 32, lineHeight: 36 }}>
          Library
        </T>
        <IconButton label="Offline" onPress={() => router.push('/downloads')}>
          <Download />
        </IconButton>
      </View>

      <View style={{ paddingHorizontal: 24, gap: 10 }}>
        <Button label={importing ? (importing.total ? `Importing… ${importing.done}/${importing.total}` : 'Importing…') : 'Import comics'} disabled={!!importing} onPress={runImport} />
        <T v="caption" style={{ fontSize: 12 }}>
          PDF, CBZ, JPEG, PNG or WebP. Select several images to make one comic. Files stay on this device.
        </T>
        {notice && (
          <View style={[styles.notice, { borderColor: notice.tone === 'ok' ? color.ash : color.ember }]} accessibilityLiveRegion="polite">
            <T v="body" style={{ color: notice.tone === 'ok' ? color.bone : color.ember }}>
              {notice.text}
            </T>
          </View>
        )}
      </View>

      {shelves.continueReading.length > 0 && !collectionId && filter === 'all' && (
        <Shelf title="Continue reading">
          {shelves.continueReading.map((it) => (
            <Tile key={it.key} item={it} state={state} onPress={() => open(it)} />
          ))}
        </Shelf>
      )}
      {shelves.recentlyAdded.length > 0 && !collectionId && filter === 'all' && (
        <Shelf title="Recently added">
          {shelves.recentlyAdded.map((it) => (
            <Tile key={it.key} item={it} state={state} onPress={() => open(it)} />
          ))}
        </Shelf>
      )}

      <View style={{ paddingTop: 24 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              active={!collectionId && filter === f.key}
              onPress={() => {
                setCollectionId(null);
                setFilter(f.key);
              }}
            />
          ))}
          {state.collections.map((c) => (
            <Chip key={c.id} label={c.name} tone="storm" active={collectionId === c.id} onPress={() => setCollectionId(collectionId === c.id ? null : c.id)} />
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="New collection" onPress={() => setNaming(true)} style={styles.addChip}>
            <Plus size={16} />
          </Pressable>
        </ScrollView>
        {naming && (
          <View style={styles.newCollection}>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Collection name"
              placeholderTextColor={color.smoke}
              style={styles.input}
              maxLength={60}
              accessibilityLabel="Collection name"
              onSubmitEditing={() => {
                dispatch({ type: 'createCollection', id: Crypto.randomUUID(), name, now: Date.now() });
                setName('');
                setNaming(false);
              }}
            />
            <Button
              label="Create"
              height={40}
              disabled={!name.trim()}
              onPress={() => {
                dispatch({ type: 'createCollection', id: Crypto.randomUUID(), name, now: Date.now() });
                setName('');
                setNaming(false);
              }}
            />
          </View>
        )}
        {activeCollection && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12 }}>
            <T v="caption">Add titles from their detail page.</T>
            <Button
              kind="ghost"
              label="Delete collection"
              height={34}
              onPress={() => {
                dispatch({ type: 'deleteCollection', id: activeCollection.collection.id });
                setCollectionId(null);
              }}
            />
          </View>
        )}
      </View>

      <View style={styles.grid}>
        {base.length === 0 && (
          <T v="caption" style={{ paddingHorizontal: 24, paddingVertical: 12 }}>
            {filter === 'imported' && !collectionId ? 'No imported comics yet.' : 'Nothing here yet.'}
          </T>
        )}
        {base.map((it) => (
          <Tile key={it.key} item={it} state={state} onPress={() => open(it)} grid />
        ))}
      </View>

      {bookmarks.length > 0 && (
        <View style={styles.section}>
          <T v="title">Bookmarks</T>
          {bookmarks.map((b) => {
            const local = state.library.find((p) => localKey(p.id) === b.key);
            const ch = local ? undefined : getChapter(b.chapterId);
            const title = local ? local.title : ch ? `${ch.label} · ${ch.title}` : b.chapterId;
            const label = local ? String(b.page + 1) : (ch?.pages[b.page]?.label ?? String(b.page + 1));
            return (
              <Row
                key={b.id}
                onPress={() => {
                  dispatch({ type: 'advance', seriesId: b.key, position: { chapter: local ? 1 : (ch?.number ?? 1), page: b.page, panel: 0 }, now: Date.now() });
                  router.push(`/read/${encodeURIComponent(b.chapterId)}`);
                }}
                accessibilityRole="button"
                style={styles.row}
              >
                <View style={{ flex: 1 }}>
                  <T v="body" style={{ color: color.bone }} numberOfLines={1}>
                    {title}
                  </T>
                  <T v="caption" style={{ fontSize: 12 }}>
                    Page {label}
                  </T>
                </View>
                <Button kind="ghost" label="Remove" height={32} onPress={() => dispatch({ type: 'removeBookmark', id: b.id })} />
              </Row>
            );
          })}
        </View>
      )}

      {history.length > 0 && (
        <View style={styles.section}>
          <T v="title">Reading history</T>
          {history.map((h) => {
            const local = state.library.find((p) => localKey(p.id) === h.key);
            const ch = local ? undefined : getChapter(h.chapterId);
            if (!local && !ch) return null;
            return (
              <Row key={h.chapterId} onPress={() => router.push(`/read/${encodeURIComponent(h.chapterId)}`)} accessibilityRole="button" style={styles.row}>
                <View style={{ flex: 1 }}>
                  <T v="body" style={{ color: color.bone }} numberOfLines={1}>
                    {local ? local.title : `${getSeries(ch!.seriesId)?.title} · ${ch!.label} · ${ch!.title}`}
                  </T>
                  <T v="caption" style={{ fontSize: 12 }}>
                    {new Date(h.at).toLocaleString()}
                  </T>
                </View>
              </Row>
            );
          })}
        </View>
      )}

    </ScrollView>
  );
}

function Shelf({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingTop: 24, gap: 12 }}>
      <T v="title" style={{ paddingHorizontal: 24 }}>
        {title}
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}>
        {children}
      </ScrollView>
    </View>
  );
}

function Tile({ item, state, onPress, grid }: { item: ShelfItem; state: ReaderState; onPress: () => void; grid?: boolean }) {
  const pub = item.kind === 'local' ? state.library.find((p) => localKey(p.id) === item.key) : undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${item.completed ? ', completed' : item.progress > 0 ? `, ${Math.round(item.progress * 100)}% read` : ', unread'}`}
      style={[styles.tile, grid && styles.gridTile]}
    >
      {pub ? (
        <LocalCover pub={pub} style={styles.cover} />
      ) : (
        <View style={styles.cover}>{coverImages[item.key] && <Image source={coverImages[item.key]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />}</View>
      )}
      <ProgressBar value={item.completed ? 1 : item.progress} />
      <T v="caption" numberOfLines={2} style={{ color: color.bone, fontFamily: font.uiMedium }}>
        {item.title}
      </T>
      {(item.favorite || item.purchased) && (
        <T v="mono" style={{ fontSize: 9 }}>
          {[item.favorite && 'FAVORITE', item.purchased && 'PURCHASED'].filter(Boolean).join(' · ')}
        </T>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 12, paddingBottom: 14 },
  notice: { padding: 14, borderRadius: radius.md, backgroundColor: color.char, borderWidth: 1 },
  addChip: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 1, borderColor: color.ash, alignItems: 'center', justifyContent: 'center' },
  newCollection: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingTop: 12, alignItems: 'center' },
  input: { flex: 1, height: 40, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: color.char, color: color.bone, fontFamily: font.ui, borderWidth: 1, borderColor: color.ash },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 18, paddingTop: 16, gap: 12 },
  tile: { width: 110, gap: 6 },
  gridTile: { width: 104 },
  cover: { width: '100%', aspectRatio: 2 / 3, borderRadius: 10, overflow: 'hidden', backgroundColor: color.char },
  section: { paddingHorizontal: 24, paddingTop: 28, gap: 4 },
  row: { minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
});
