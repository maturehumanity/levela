import { getCountryDialCode, getCountryFlag, getCountryName, getCountryOptions, type CountryOption } from './countries';

export type PhoneCountryOption = CountryOption & {
  dialCode: string;
};

export function getPhoneCountrySummary(countryCode: string, locale: string): PhoneCountryOption {
  const normalizedCountryCode = countryCode.toUpperCase();

  return {
    code: normalizedCountryCode,
    label: getCountryName(normalizedCountryCode, locale),
    flag: getCountryFlag(normalizedCountryCode),
    dialCode: getCountryDialCode(normalizedCountryCode),
  };
}

export function getPhoneCountryOptions(locale: string): PhoneCountryOption[] {
  return getCountryOptions(locale)
    .map((option) => ({
      ...option,
      dialCode: getCountryDialCode(option.code),
    }))
    .filter((option) => option.dialCode);
}
