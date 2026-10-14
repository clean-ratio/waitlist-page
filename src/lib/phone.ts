import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/** Numbers typed without a country code are read as this country's. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'IN';

/**
 * The same shape the database accepts (see join_waitlist in
 * supabase/schema.sql): a plus, then up to 15 digits, not starting with 0.
 */
export const E164_PATTERN = /^\+[1-9][0-9]{6,14}$/;

/**
 * Spaces, dashes, dots and brackets are fine; they are stripped by the parser.
 * Returns the number in E.164 (+919876543210), null when the field is empty,
 * or undefined when it is not a valid number.
 */
export function normalisePhone(raw: string): string | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  const phone = parsePhoneNumberFromString(value, DEFAULT_PHONE_COUNTRY);
  if (!phone?.isValid()) return undefined;
  return E164_PATTERN.test(phone.number) ? phone.number : undefined;
}

/** For logs: never the whole number. "+919876543210" → "+91•••••••210". */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 5) return '•'.repeat(digits.length);
  return `+${digits.slice(0, 2)}${'•'.repeat(digits.length - 5)}${digits.slice(-3)}`;
}

/** Masks anything in free text that looks like a phone number. */
export function maskPhonesIn(text: string): string {
  return text.replace(/\+?\d[\d\s().-]{5,}\d/g, maskPhone);
}
