import { ulid } from 'ulid';

export function createPublicId(prefix: string): string {
  return `${prefix}_${ulid().toLowerCase()}`;
}
