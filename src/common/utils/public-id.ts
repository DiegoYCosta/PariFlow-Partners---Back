import { ulid } from 'ulid';

export function createPublicId(prefix: string): string {
  const suffixLength = Math.max(1, 26 - (prefix.length + 1));
  const suffix = ulid().toLowerCase().slice(-suffixLength);

  return `${prefix}_${suffix}`;
}
