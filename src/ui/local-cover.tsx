import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { LocalPublication } from '@/domain/library';
import { resolvePages } from '@/services/page-store';
import { color } from '@/theme/tokens';

import { T } from './kit';

/** Cover art for an imported comic: its chosen cover page, read from device storage. */
export function LocalCover({ pub, style }: { pub: LocalPublication; style?: StyleProp<ViewStyle> }) {
  const [uri, setUri] = useState<string | null>(null);
  const page = pub.pages[pub.coverPage] ?? pub.pages[0];
  useEffect(() => {
    let alive = true;
    resolvePages(pub).then((u) => alive && page && setUri(u[page.file] ?? null));
    return () => {
      alive = false;
    };
  }, [pub, page]);
  return (
    <View style={[styles.box, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={150} recyclingKey={pub.id} />
      ) : (
        <T v="mono" style={{ fontSize: 10 }}>
          {pub.format.toUpperCase()}
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: color.char, alignItems: 'center', justifyContent: 'center' },
});
