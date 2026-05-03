/**
 * Lecture d'un fichier (PDF / texte) vers un attachement compatible Claude.
 *
 * - PDF : encodage base64 sans le préfixe `data:`
 * - TXT : contenu brut
 *
 * Refuse les fichiers non supportés ou trop volumineux pour préserver
 * les limites du backend.
 */
export const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'text/plain',
] as const;
export type AllowedAttachmentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number];

export interface FileAttachment {
  readonly name: string;
  readonly mediaType: AllowedAttachmentType;
  readonly data: string;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export class UnsupportedAttachmentError extends Error {
  constructor(public readonly fileName: string) {
    super(`Format non supporté pour « ${fileName} » (PDF ou TXT uniquement).`);
    this.name = 'UnsupportedAttachmentError';
  }
}

export class AttachmentTooLargeError extends Error {
  constructor(public readonly fileName: string) {
    super(`« ${fileName} » dépasse 5 Mo.`);
    this.name = 'AttachmentTooLargeError';
  }
}

export async function readFileAsAttachment(file: File): Promise<FileAttachment> {
  if (!isAllowedType(file.type)) {
    throw new UnsupportedAttachmentError(file.name);
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new AttachmentTooLargeError(file.name);
  }
  const data =
    file.type === 'application/pdf'
      ? await readAsBase64(file)
      : await readAsText(file);
  return { name: file.name, mediaType: file.type, data };
}

function isAllowedType(value: string): value is AllowedAttachmentType {
  return (ALLOWED_ATTACHMENT_TYPES as ReadonlyArray<string>).includes(value);
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Lecture du fichier impossible.'));
        return;
      }
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Lecture du fichier impossible.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Lecture du fichier impossible.'));
    reader.readAsText(file);
  });
}
