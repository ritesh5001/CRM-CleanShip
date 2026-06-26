// Maps a (free-text) country name to its calling code and a representative IANA
// timezone. Used to (a) prepend a country code when dialling a local number and
// (b) show the country's current local time in the contacts table.
// Keys are lower-cased; common aliases are included.

interface CountryInfo {
  code: string; // E.164 calling code, e.g. '+91'
  tz: string; // representative IANA timezone
}

const COUNTRIES: Record<string, CountryInfo> = {
  india: { code: '+91', tz: 'Asia/Kolkata' },
  'united states': { code: '+1', tz: 'America/New_York' },
  'united states of america': { code: '+1', tz: 'America/New_York' },
  usa: { code: '+1', tz: 'America/New_York' },
  us: { code: '+1', tz: 'America/New_York' },
  america: { code: '+1', tz: 'America/New_York' },
  canada: { code: '+1', tz: 'America/Toronto' },
  'united kingdom': { code: '+44', tz: 'Europe/London' },
  uk: { code: '+44', tz: 'Europe/London' },
  'great britain': { code: '+44', tz: 'Europe/London' },
  england: { code: '+44', tz: 'Europe/London' },
  australia: { code: '+61', tz: 'Australia/Sydney' },
  'new zealand': { code: '+64', tz: 'Pacific/Auckland' },
  'united arab emirates': { code: '+971', tz: 'Asia/Dubai' },
  uae: { code: '+971', tz: 'Asia/Dubai' },
  'saudi arabia': { code: '+966', tz: 'Asia/Riyadh' },
  qatar: { code: '+974', tz: 'Asia/Qatar' },
  kuwait: { code: '+965', tz: 'Asia/Kuwait' },
  bahrain: { code: '+973', tz: 'Asia/Bahrain' },
  oman: { code: '+968', tz: 'Asia/Muscat' },
  singapore: { code: '+65', tz: 'Asia/Singapore' },
  malaysia: { code: '+60', tz: 'Asia/Kuala_Lumpur' },
  indonesia: { code: '+62', tz: 'Asia/Jakarta' },
  philippines: { code: '+63', tz: 'Asia/Manila' },
  thailand: { code: '+66', tz: 'Asia/Bangkok' },
  vietnam: { code: '+84', tz: 'Asia/Ho_Chi_Minh' },
  china: { code: '+86', tz: 'Asia/Shanghai' },
  'hong kong': { code: '+852', tz: 'Asia/Hong_Kong' },
  japan: { code: '+81', tz: 'Asia/Tokyo' },
  'south korea': { code: '+82', tz: 'Asia/Seoul' },
  pakistan: { code: '+92', tz: 'Asia/Karachi' },
  bangladesh: { code: '+880', tz: 'Asia/Dhaka' },
  'sri lanka': { code: '+94', tz: 'Asia/Colombo' },
  nepal: { code: '+977', tz: 'Asia/Kathmandu' },
  germany: { code: '+49', tz: 'Europe/Berlin' },
  france: { code: '+33', tz: 'Europe/Paris' },
  spain: { code: '+34', tz: 'Europe/Madrid' },
  italy: { code: '+39', tz: 'Europe/Rome' },
  netherlands: { code: '+31', tz: 'Europe/Amsterdam' },
  belgium: { code: '+32', tz: 'Europe/Brussels' },
  switzerland: { code: '+41', tz: 'Europe/Zurich' },
  sweden: { code: '+46', tz: 'Europe/Stockholm' },
  norway: { code: '+47', tz: 'Europe/Oslo' },
  denmark: { code: '+45', tz: 'Europe/Copenhagen' },
  ireland: { code: '+353', tz: 'Europe/Dublin' },
  portugal: { code: '+351', tz: 'Europe/Lisbon' },
  poland: { code: '+48', tz: 'Europe/Warsaw' },
  russia: { code: '+7', tz: 'Europe/Moscow' },
  turkey: { code: '+90', tz: 'Europe/Istanbul' },
  'south africa': { code: '+27', tz: 'Africa/Johannesburg' },
  nigeria: { code: '+234', tz: 'Africa/Lagos' },
  kenya: { code: '+254', tz: 'Africa/Nairobi' },
  egypt: { code: '+20', tz: 'Africa/Cairo' },
  brazil: { code: '+55', tz: 'America/Sao_Paulo' },
  mexico: { code: '+52', tz: 'America/Mexico_City' },
  argentina: { code: '+54', tz: 'America/Argentina/Buenos_Aires' },
  israel: { code: '+972', tz: 'Asia/Jerusalem' },
};

export function countryInfo(country?: string | null): CountryInfo | null {
  if (!country) return null;
  return COUNTRIES[country.trim().toLowerCase()] ?? null;
}

/** E.164 calling code for a country name, or null if unknown. */
export function countryCallingCode(country?: string | null): string | null {
  return countryInfo(country)?.code ?? null;
}

/** Current local time in a country (e.g. "3:45 PM"), or null if unknown. */
export function countryCurrentTime(country?: string | null): string | null {
  const tz = countryInfo(country)?.tz;
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch {
    return null;
  }
}
