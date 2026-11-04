/** Clé RIB marocaine : 97 − ((banque + ville + compte) × 100 mod 97). */
export function moroccanRibKey(body22: string): string | null {
  if (!/^\d{22}$/.test(body22)) return null;
  let remainder = 0;
  for (const char of `${body22}00`) {
    remainder = (remainder * 10 + Number(char)) % 97;
  }
  return String(97 - remainder).padStart(2, "0");
}

export function ribDigits(value: string) {
  return value.replace(/\s+/g, "");
}

/** Null when the RIB is vide ou valide. Message français sinon. */
export function moroccanRibError(value: string | null | undefined): string | null {
  const digits = ribDigits(value ?? "");
  if (!digits) return null;
  if (!/^\d{24}$/.test(digits)) return "Le RIB marocain doit contenir exactement 24 chiffres.";
  const expected = moroccanRibKey(digits.slice(0, 22));
  if (!expected || digits.slice(22) !== expected) return "La clé du RIB est incorrecte. Vérifiez les 24 chiffres.";
  return null;
}

export function formatRib(value: string | null | undefined) {
  const digits = ribDigits(value ?? "");
  if (digits.length !== 24) return value?.trim() || null;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 22)} ${digits.slice(22)}`;
}
