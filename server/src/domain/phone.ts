/**
 * Normalize a phone to E.164, defaulting to Lebanon (+961) when no country code
 * is given. Lebanese users routinely type local formats — "03 123456",
 * "71 122 020", "03-123-456" — which Twilio rejects. This turns those into
 * "+9613123456" / "+96171122020" while leaving any explicit international
 * number ("+961…", "+1…") untouched.
 */
export function normalizePhone(phone: string): string {
  const trimmed = (phone ?? '').trim();

  // Already international (has a +): keep it, just strip non-digits.
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.replace(/[^0-9]/g, '');
  }

  let digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return '';

  // "00" is the international dialing prefix — what follows is a country code.
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  // Already carries Lebanon's country code, just without the +.
  if (digits.startsWith('961')) return '+' + digits;
  // Drop the domestic trunk "0" (e.g. 03… → 3…).
  if (digits.startsWith('0')) digits = digits.slice(1);
  // Bare local number → assume Lebanon.
  return '+961' + digits;
}
