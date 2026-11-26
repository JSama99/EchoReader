import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { color } from '@/theme/tokens';

type P = { size?: number; color?: string; strokeWidth?: number };

const stroke = (c?: string) => c ?? color.bone;

export const FlameMark = ({ size = 22, color: c = color.ember }: P) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Circle cx={11} cy={11} r={9.5} stroke={c} strokeWidth={1.5} />
    <Path d="M11 4.5c2 3 3.5 4.6 3.5 7.2A3.5 3.5 0 0 1 11 15.2a3.5 3.5 0 0 1-3.5-3.5c0-1.4.7-2.4 1.6-3.3.2 1.1.8 1.8 1.6 2.1C10.4 8.6 10.4 6.6 11 4.5Z" fill={c} />
    <Path d="M7 17.5h8" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

export const Ember = ({ size = 14, color: c = color.ember }: P) => (
  <Svg width={size * (12 / 14)} height={size} viewBox="0 0 12 14">
    <Path d="M6 1c2 2.6 3.6 4 3.6 6.6A3.6 3.6 0 0 1 6 11.2a3.6 3.6 0 0 1-3.6-3.6c0-1.3.7-2.3 1.5-3.1.2 1 .8 1.6 1.5 1.9C5.2 4.6 5.4 2.8 6 1Z" fill={c} />
  </Svg>
);

export const Back = ({ size = 24, color: c }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke(c)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m14.5 5-7 7 7 7" />
  </Svg>
);

export const Close = ({ size = 24, color: c }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke(c)} strokeWidth={2} strokeLinecap="round">
    <Path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const Search = ({ size = 22, color: c }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke(c)} strokeWidth={1.8} strokeLinecap="round">
    <Circle cx={11} cy={11} r={6.5} />
    <Path d="m20 20-4.2-4.2" />
  </Svg>
);

export const Download = ({ size = 20, color: c }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke(c)} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
  </Svg>
);

export const Check = ({ size = 18, color: c }: P) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={stroke(c)} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m3 8.5 3.2 3L13 4.5" />
  </Svg>
);

export const Lock = ({ size = 14, color: c = color.smoke }: P) => (
  <Svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth={1.2}>
    <Rect x={2} y={5.5} width={8} height={5.5} rx={1} />
    <Path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
  </Svg>
);

export const Bubble = ({ size = 14, color: c = color.storm }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round">
    <Path d="M4 5.5h16v10H9l-5 4z" />
  </Svg>
);

export const Waveform = ({ size = 16, color: c = color.storm }: P) => (
  <Svg width={size} height={size * 0.875} viewBox="0 0 16 14" fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round">
    <Path d="M1 7h1.5M4.5 4v6M8 1.5v11M11.5 4v6M14.5 6v2" />
  </Svg>
);

export const Settings = ({ size = 22, color: c }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke(c)} strokeWidth={1.8} strokeLinecap="round">
    <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <Circle cx={16} cy={7} r={2} />
    <Circle cx={8} cy={17} r={2} />
  </Svg>
);

export const Shield = ({ size = 12, color: c = color.bone, ok = true }: P & { ok?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
    <Path d="M6 .8 10.5 3v3.2c0 2.4-1.9 4.4-4.5 5-2.6-.6-4.5-2.6-4.5-5V3Z" stroke={c} strokeWidth={1.1} />
    {ok ? (
      <Path d="m3.9 6 1.5 1.5L8.2 4.7" stroke={c} strokeWidth={1.1} strokeLinecap="round" />
    ) : (
      <>
        <Path d="M6 3.6v2.6" stroke={c} strokeWidth={1.1} strokeLinecap="round" />
        <Circle cx={6} cy={7.9} r={0.55} fill={c} />
      </>
    )}
  </Svg>
);

export const GlyphMark = ({ size = 26, color: c = color.glyph }: P) => (
  <Svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round">
    <Circle cx={13} cy={13} r={9} />
    <Path d="M13 3v20M5.5 9.5 13 13l7.5-3.5M7.5 18l5.5-3 5.5 3" />
  </Svg>
);

export const ModeIcon = ({ mode, size = 26, color: c = color.smoke }: P & { mode: 'sigil' | 'scroll' | 'pages' }) => (
  <Svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke={c} strokeWidth={1.6}>
    {mode === 'sigil' && (
      <>
        <Rect x={3} y={3} width={20} height={20} rx={2} strokeOpacity={0.45} />
        <Rect x={6} y={9} width={14} height={8} rx={1} />
      </>
    )}
    {mode === 'scroll' && (
      <>
        <Rect x={7} y={2} width={12} height={9} rx={1} />
        <Rect x={7} y={14} width={12} height={10} rx={1} />
      </>
    )}
    {mode === 'pages' && (
      <>
        <Rect x={2} y={5} width={10} height={16} rx={1} />
        <Rect x={14} y={5} width={10} height={16} rx={1} />
      </>
    )}
  </Svg>
);

// Tab bar
export const TabLibrary = ({ size = 24, color: c }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke(c)} strokeWidth={1.8} strokeLinejoin="round">
    <Path d="M4 4.5h5v15H4zM10.5 4.5h5v15h-5zM17 5.2l3.4-.9 3 14.4-3.4.9z" />
  </Svg>
);
export const TabDiscover = ({ size = 24, color: c }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke(c)} strokeWidth={1.8}>
    <Circle cx={12} cy={12} r={8.5} />
    <Path d="m15.5 8.5-2 5-5 2 2-5z" strokeLinejoin="round" />
  </Svg>
);
export const TabCodex = ({ size = 24, color: c }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke(c)} strokeWidth={1.8}>
    <Path d="M12 3.5 20 12l-8 8.5L4 12z" strokeLinejoin="round" />
    <Circle cx={12} cy={12} r={2.5} />
  </Svg>
);
export const TabCypher = ({ size = 24, color: c }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke(c)} strokeWidth={1.8} strokeLinecap="round">
    <Path d="M5 7.5h14M5 12h14M5 16.5h9" />
  </Svg>
);
