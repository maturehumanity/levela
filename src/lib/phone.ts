import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { getCountryDialCode, getCountryFlag, getCountryName, getCountryOptions } from './countries';

export type PhoneDraft = {
  countryCode: string;
  dialCode: string;
  localNumber: string;
  e164: string | null;
};

export function createPhoneDraft(countryCode: string, localNumber = ''): PhoneDraft {
  const normalizedCountryCode = countryCode.toUpperCase();
  const trimmedNumber = localNumber.trim();
  const parsed = parsePhoneNumberFromString(trimmedNumber, normalizedCountryCode as CountryCode);

  return {
    countryCode: normalizedCountryCode,
    dialCode: getCountryDialCode(normalizedCountryCode),
    localNumber: trimmedNumber,
    e164: parsed?.isValid() ? parsed.number : null,
  };
}

export function getPhoneCountrySummary(countryCode: string, locale: string) {
  const normalizedCountryCode = countryCode.toUpperCase();
  return {
    code: normalizedCountryCode,
    label: getCountryName(normalizedCountryCode, locale),
    flag: getCountryFlag(normalizedCountryCode),
    dialCode: getCountryDialCode(normalizedCountryCode),
  };
}

export function getPhoneCountryOptions(locale: string) {
  return getCountryOptions(locale).filter((option) => option.dialCode);
}
