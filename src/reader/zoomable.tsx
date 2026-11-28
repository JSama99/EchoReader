import { useState, type ReactNode } from 'react';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture, useExclusiveGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MAX = 5;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * Pinch-to-zoom, pan while zoomed, double-tap to zoom at a point or reset.
 * Translation is clamped so the page edge never leaves the viewport. The
 * parent disables its own paging while zoomed via `onZoomChange`.
 */
export function Zoomable({
  width,
  height,
  children,
  onZoomChange,
  reduceMotion,
}: {
  width: number;
  height: number;
  children: ReactNode;
  onZoomChange?: (zoomed: boolean) => void;
  reduceMotion?: boolean;
}) {
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const report = (z: boolean) => {
    setZoomed(z);
    onZoomChange?.(z);
  };

  const clampX = (x: number, s: number) => {
    'worklet';
    const max = (width * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, x));
  };
  const clampY = (y: number, s: number) => {
    'worklet';
    const max = (height * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, y));
  };
  const settle = (s: number, x: number, y: number) => {
    'worklet';
    const d = reduceMotion ? 0 : 180;
    scale.value = withTiming(s, { duration: d });
    tx.value = withTiming(x, { duration: d });
    ty.value = withTiming(y, { duration: d });
    savedScale.value = s;
    savedX.value = x;
    savedY.value = y;
    scheduleOnRN(report, s > 1.01);
  };

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      const s = Math.min(MAX, Math.max(0.8, savedScale.value * e.scale));
      scale.value = s;
      tx.value = clampX(savedX.value, s);
      ty.value = clampY(savedY.value, s);
    },
    onDeactivate: () => {
      'worklet';
      const s = scale.value < 1.05 ? 1 : scale.value;
      settle(s, s === 1 ? 0 : clampX(tx.value, s), s === 1 ? 0 : clampY(ty.value, s));
    },
  });

  const pan = usePanGesture({
    enabled: zoomed,
    onUpdate: (e) => {
      'worklet';
      tx.value = clampX(savedX.value + e.translationX, scale.value);
      ty.value = clampY(savedY.value + e.translationY, scale.value);
    },
    onDeactivate: () => {
      'worklet';
      savedX.value = tx.value;
      savedY.value = ty.value;
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: (e) => {
      'worklet';
      if (savedScale.value > 1.01) {
        settle(1, 0, 0);
        return;
      }
      const s = DOUBLE_TAP_SCALE;
      // Keep the tapped point under the finger: views scale about their center.
      settle(s, clampX((e.x - width / 2) * (1 - s), s), clampY((e.y - height / 2) * (1 - s), s));
    },
  });

  const gesture = useExclusiveGestures(doubleTap, useSimultaneousGestures(pinch, pan));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[{ width, height }, style]}
        accessibilityHint={zoomed ? 'Zoomed in. Double-tap to reset.' : 'Pinch or double-tap to zoom.'}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
