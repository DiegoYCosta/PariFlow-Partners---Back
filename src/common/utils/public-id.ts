import { ulid } from 'ulid';

// publicId e o identificador externo estavel. URL, cache e selecao no front
// devem continuar nele, nunca no id numerico interno do banco.
export function createPublicId(prefix: string): string {
  const suffixLength = Math.max(1, 26 - (prefix.length + 1));
  const suffix = ulid().toLowerCase().slice(-suffixLength);

  return `${prefix}_${suffix}`;
}
