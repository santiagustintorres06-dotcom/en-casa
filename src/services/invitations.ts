export function invitationCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export const normalizeCode = (value: string) => value.trim().toLowerCase();
