import { getCountryCallingCode, isSupportedCountry, type CountryCode } from 'libphonenumber-js';

export type CountryOption = {
  code: string;
  label: string;
  flag: string;
  dialCode: string;
};

const COUNTRY_CODES = [
  'AF', 'AL', 'DZ', 'AD', 'AO', 'AG', 'AR', 'AM', 'AU', 'AT', 'AZ',
  'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BT', 'BO', 'BA', 'BW', 'BR', 'BN', 'BG', 'BF', 'BI',
  'CV', 'KH', 'CM', 'CA', 'CF', 'TD', 'CL', 'CN', 'CO', 'KM', 'CG', 'CD', 'CR', 'CI', 'HR', 'CU', 'CY', 'CZ',
  'DK', 'DJ', 'DM', 'DO',
  'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET',
  'FJ', 'FI', 'FR',
  'GA', 'GM', 'GE', 'DE', 'GH', 'GR', 'GD', 'GT', 'GN', 'GW', 'GY',
  'HT', 'HN', 'HU',
  'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IL', 'IT',
  'JM', 'JP', 'JO',
  'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG',
  'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU',
  'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MR', 'MU', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MA', 'MZ', 'MM',
  'NA', 'NR', 'NP', 'NL', 'NZ', 'NI', 'NE', 'NG', 'MK', 'NO',
  'OM',
  'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PL', 'PT',
  'QA',
  'RO', 'RU', 'RW',
  'KN', 'LC', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SB', 'SO', 'ZA', 'SS', 'ES', 'LK', 'SD', 'SR', 'SE', 'CH', 'SY',
  'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TO', 'TT', 'TN', 'TR', 'TM', 'TV',
  'UG', 'UA', 'AE', 'GB', 'US', 'UY', 'UZ',
  'VU', 'VA', 'VE', 'VN',
  'YE',
  'ZM', 'ZW',
] as const;

function createDisplayNames(locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  }
}

export function getCountryFlag(code: string): string {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '🌍';
  return String.fromCodePoint(
    ...upper.split('').map((char) => 127397 + char.charCodeAt(0)),
  );
}

export function getCountryDialCode(code: string): string {
  const upper = code.toUpperCase();
  if (isSupportedCountry(upper as CountryCode)) {
    return `+${getCountryCallingCode(upper as CountryCode)}`;
  }
  return '';
}

export function getCountryName(code: string, locale: string): string {
  const displayNames = createDisplayNames(locale);
  return displayNames.of(code.toUpperCase()) || code.toUpperCase();
}

export function getCountryCodeFromName(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  if (/^[a-z]{2}$/i.test(normalized)) {
    const upper = normalized.toUpperCase();
    return COUNTRY_CODES.includes(upper as (typeof COUNTRY_CODES)[number]) ? upper : null;
  }

  const englishDisplayNames = createDisplayNames('en');

  for (const code of COUNTRY_CODES) {
    const label = (englishDisplayNames.of(code) || code).trim().toLowerCase();
    if (label === normalized) {
      return code;
    }
  }

  return null;
}

export function getCountryOptions(locale: string): CountryOption[] {
  return COUNTRY_CODES
    .map((code) => ({
      code,
      label: getCountryName(code, locale),
      flag: getCountryFlag(code),
      dialCode: getCountryDialCode(code),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, locale));
}
