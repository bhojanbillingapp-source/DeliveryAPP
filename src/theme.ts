// Design tokens mirrored from the frontend POS/kiosk palette
// (frontend/src/theme/pos.ts — POS_COLORS) so the customer app looks like
// the same product family as the staff kiosk screens, not a different app.
export const colors = {
  primary: '#1C274C', // posNavy — structural CTAs, stepper, active states
  primaryDark: '#141B38',
  accent: '#FF7A1A', // posAccentOrange — primary customer-facing CTA (checkout/pay)
  success: '#2E7D32',
  danger: '#D32F2F',
  warning: '#C9992A',
  text: '#000000', // posTextBlack
  textMuted: '#A19E9C', // posGray
  border: '#DDDBDA', // posBorder
  surface: '#FFFFFF',
  iconBg: '#F5F5F5', // posIconBg
  background: '#F9F4F0', // posBg
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const statusColors: Record<string, { bg: string; fg: string }> = {
  OPEN: { bg: '#FDEBD3', fg: '#B4650A' },
  CLOSED: { bg: '#DFF3E3', fg: '#1E7A3B' },
  CANCELLED: { bg: '#FBE0E0', fg: '#C0392B' },
};
