import type { CvTemplateValue } from '@org/schemas';

export function buildCvFilename(
  lastName: string | null | undefined,
  template: CvTemplateValue,
  suffix?: string,
): string {
  const base = (lastName ?? 'consultant')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'consultant';
  return `${base}_${template}${suffix ? `_${suffix}` : ''}.pdf`;
}
