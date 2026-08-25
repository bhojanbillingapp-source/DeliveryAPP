export type CountryCode = {
  name: string;
  dial_code: string;
  flag: string;
};

// Common countries first (India default), then the rest alphabetically.
export const COUNTRY_CODES: CountryCode[] = [
  { name: 'India', dial_code: '+91', flag: '🇮🇳' },
  { name: 'United States', dial_code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', dial_code: '+44', flag: '🇬🇧' },
  { name: 'United Arab Emirates', dial_code: '+971', flag: '🇦🇪' },
  { name: 'Australia', dial_code: '+61', flag: '🇦🇺' },
  { name: 'Canada', dial_code: '+1', flag: '🇨🇦' },
  { name: 'Singapore', dial_code: '+65', flag: '🇸🇬' },
  { name: 'Saudi Arabia', dial_code: '+966', flag: '🇸🇦' },
  { name: 'Qatar', dial_code: '+974', flag: '🇶🇦' },
  { name: 'Kuwait', dial_code: '+965', flag: '🇰🇼' },
  { name: 'Bahrain', dial_code: '+973', flag: '🇧🇭' },
  { name: 'Oman', dial_code: '+968', flag: '🇴🇲' },
  { name: 'Nepal', dial_code: '+977', flag: '🇳🇵' },
  { name: 'Sri Lanka', dial_code: '+94', flag: '🇱🇰' },
  { name: 'Bangladesh', dial_code: '+880', flag: '🇧🇩' },
  { name: 'Pakistan', dial_code: '+92', flag: '🇵🇰' },
  { name: 'Germany', dial_code: '+49', flag: '🇩🇪' },
  { name: 'France', dial_code: '+33', flag: '🇫🇷' },
  { name: 'Italy', dial_code: '+39', flag: '🇮🇹' },
  { name: 'Spain', dial_code: '+34', flag: '🇪🇸' },
  { name: 'Netherlands', dial_code: '+31', flag: '🇳🇱' },
  { name: 'Ireland', dial_code: '+353', flag: '🇮🇪' },
  { name: 'New Zealand', dial_code: '+64', flag: '🇳🇿' },
  { name: 'South Africa', dial_code: '+27', flag: '🇿🇦' },
  { name: 'Malaysia', dial_code: '+60', flag: '🇲🇾' },
  { name: 'China', dial_code: '+86', flag: '🇨🇳' },
  { name: 'Japan', dial_code: '+81', flag: '🇯🇵' },
];
