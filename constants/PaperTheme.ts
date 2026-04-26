import { Platform } from 'react-native';

export const Paper = {
  colors: {
    background:   '#F5F2EC',
    surface:      '#FFFFFF',
    surfaceWarm:  '#FAF8F4',
    navy:         '#1A1A2E',
    navyMuted:    '#2D2D45',
    orange:       '#FF6B35',
    orangeLight:  '#FFF0EB',
    sand:         '#8B7355',
    sandLight:    '#C4B89A',
    border:       '#E2DDD4',
    borderLight:  '#EDE9E2',
    success:      '#2D7A4F',
    successLight: '#EAF4EE',
    white:        '#FFFFFF',
    error:        '#C0392B',
  },
  type: {
    wordmark:     { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.5 },
    balanceLarge: { fontSize: 56, fontWeight: '700' as const, letterSpacing: -3 },
    balanceSup:   { fontSize: 26, fontWeight: '400' as const, letterSpacing: 0 },
    heading:      { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.5 },
    label:        { fontSize: 10, fontWeight: '700' as const, letterSpacing: 1.2 },
    body:         { fontSize: 14, fontWeight: '400' as const },
    bodyMed:      { fontSize: 14, fontWeight: '600' as const },
    caption:      { fontSize: 12, fontWeight: '500' as const },
  },
  radius: {
    sm:   10,
    md:   14,
    lg:   20,
    full: 999,
  },
  space: {
    screenH: 20,
    screenV: 24,
    section: 28,
    item:    12,
    inner:   14,
  },
  fonts: {
    mono: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
} as const;
