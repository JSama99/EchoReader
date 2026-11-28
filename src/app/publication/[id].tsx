import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { localKey } from '@/domain/library';
import { deletePublicationFiles } from '@/services/importer';
import { localProgress } from '@/state/derived';
import { useDispatch, useReader } from '@/state/store';
import { color, font, radius } from '@/theme/tokens';
import { Back, Star, Trash } from '@/ui/icons';
import { Button, Chip, IconButton, ProgressBar, Segmented, T } from '@/ui/kit';
import { LocalCover } from '@/ui/local-cover';

/** An imported comic: read it, edit its details, file it in collections, or remove it. */
export default function PublicationDetail() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const state = useReader((s) => s);
  const pub = state.library.find((p) => p.id === id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: pub?.title ?? '', author: pub?.author ?? '', seriesName: pub?.seriesName ?? '', number: pub?.number ?? '' });
  const [confirm, setConfirm] = useState(false);

  if (!pub) return <Redirect href="/library" />;
  const key = localKey(pub.id);
  const favorite = state.favorites.includes(key);
  const progress = localProgress(state, pub);

  const save = () => {
    const title = draft.title.trim().slice(0, 120);
    dispatch({
      type: 'updatePublication',
      id: pub.id,
      patch: {
        title: title || pub.title,
        author: draft.author.trim().slice(0, 120) || undefined,
        seriesName: draft.seriesName.trim().slice(0, 120) || undefined,
        number: draft.number.trim().slice(0, 20) || undefined,
      },
    });
    setEditing(false);
  };

  const remove = async () => {
    await deletePublicationFiles(pub.id);
    dispatch({ type: 'removePublication', id: pub.id });
    router.replace('/library');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.nav}>
        <IconButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/library'))}>
          <Back />
        </IconButton>
        <IconButton label={favorite ? 'Remove from favorites' : 'Add to favorites'} onPress={() => dispatch({ type: 'toggleFavorite', key })}>
          <Star filled={favorite} />
        </IconButton>
      </View>

      <View style={{ paddingHorizontal: 24, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <LocalCover pub={pub} style={styles.cover} />
          <View style={{ flex: 1, gap: 6, justifyContent: 'flex-end' }}>
            <T v="mono" style={{ fontSize: 10 }}>
              {pub.format.toUpperCase()} · {pub.pages.length} PAGES · {(pub.sizeBytes / 1_000_000).toFixed(1)} MB
            </T>
            <T v="title" numberOfLines={3}>
              {pub.title}
            </T>
            {pub.author && <T v="caption">{pub.author}</T>}
            <ProgressBar value={progress} style={{ marginTop: 6 }} />
            <T v="caption" style={{ fontSize: 12 }}>
              {progress >= 1 ? 'Finished' : progress > 0 ? `${Math.round(progress * 100)}% read` : 'Unread'}
            </T>
          </View>
        </View>

        <Button label={progress > 0 && progress < 1 ? 'Continue reading' : 'Read'} onPress={() => router.push(`/read/${encodeURIComponent(key)}`)} />

        <View style={{ gap: 10 }}>
          <T v="label">Reading direction</T>
          <Segmented
            value={pub.direction}
            onChange={(d) => dispatch({ type: 'updatePublication', id: pub.id, patch: { direction: d } })}
            options={[
              { key: 'ltr', label: 'Left to right' },
              { key: 'rtl', label: 'Right to left (manga)' },
            ]}
          />
        </View>

        <View style={{ gap: 10 }}>
          <T v="label">Cover</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Button kind="ghost" label="‹ Previous" height={36} disabled={pub.coverPage === 0} onPress={() => dispatch({ type: 'updatePublication', id: pub.id, patch: { coverPage: pub.coverPage - 1 } })} />
            <T v="mono" style={{ flex: 1, textAlign: 'center' }}>
              PAGE {pub.coverPage + 1}
            </T>
            <Button
              kind="ghost"
              label="Next ›"
              height={36}
              disabled={pub.coverPage >= pub.pages.length - 1}
              onPress={() => dispatch({ type: 'updatePublication', id: pub.id, patch: { coverPage: pub.coverPage + 1 } })}
            />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <T v="label">Collections</T>
          {state.collections.length === 0 ? (
            <T v="caption">Create collections from the Library tab.</T>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {state.collections.map((c) => (
                <Chip key={c.id} label={c.name} tone="storm" active={c.itemKeys.includes(key)} onPress={() => dispatch({ type: 'toggleInCollection', collectionId: c.id, key })} />
              ))}
            </View>
          )}
        </View>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T v="label">Details</T>
            {!editing && <Button kind="ghost" label="Edit" height={32} onPress={() => setEditing(true)} />}
          </View>
          {editing ? (
            <>
              {(
                [
                  ['title', 'Title'],
                  ['author', 'Author'],
                  ['seriesName', 'Series'],
                  ['number', 'Issue or volume'],
                ] as const
              ).map(([k, label]) => (
                <TextInput
                  key={k}
                  value={draft[k]}
                  onChangeText={(v) => setDraft((d) => ({ ...d, [k]: v }))}
                  placeholder={label}
                  placeholderTextColor={color.smoke}
                  accessibilityLabel={label}
                  style={styles.input}
                />
              ))}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button kind="ghost" label="Cancel" style={{ flex: 1 }} onPress={() => setEditing(false)} />
                <Button label="Save" style={{ flex: 1 }} onPress={save} />
              </View>
            </>
          ) : (
            <T v="caption">
              {[pub.seriesName && `Series: ${pub.seriesName}`, pub.number && `No. ${pub.number}`, `Imported ${new Date(pub.importedAt).toLocaleDateString()}`].filter(Boolean).join(' · ')}
            </T>
          )}
        </View>

        <View style={{ paddingTop: 12 }}>
          {!confirm ? (
            <Button kind="ghost" label="Remove from library…" onPress={() => setConfirm(true)} />
          ) : (
            <View style={styles.confirm}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Trash color={color.ember} />
                <T v="body" style={{ flex: 1, color: color.bone }}>
                  Remove “{pub.title}” and its pages from this device? Your original file elsewhere isn’t affected.
                </T>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button kind="ghost" label="Keep" style={{ flex: 1 }} onPress={() => setConfirm(false)} />
                <Button label="Remove" style={{ flex: 1 }} onPress={remove} />
              </View>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  cover: { width: 120, height: 180, borderRadius: 10 },
  input: { height: 46, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: color.char, color: color.bone, fontFamily: font.ui, borderWidth: 1, borderColor: color.ash },
  confirm: { gap: 14, padding: 16, borderRadius: radius.md, backgroundColor: color.char, borderWidth: 1, borderColor: color.ember },
});
