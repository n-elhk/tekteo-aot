import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Segment {
  readonly text: string;
  readonly highlighted: boolean;
}

/**
 * Petit composant qui rend une chaîne avec mise en surbrillance des
 * occurrences de la requête. Conçu en composant (et non en pipe) pour
 * éviter d'avoir à utiliser `[innerHTML]` (sécurité XSS).
 */
@Component({
  selector: 'app-highlight',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline' },
  template: `
    @for (segment of segments(); track $index) {
      @if (segment.highlighted) {
        <mark class="rounded bg-amber-100 text-amber-900 px-0.5 font-medium">{{ segment.text }}</mark>
      } @else {
        <span>{{ segment.text }}</span>
      }
    }
  `,
})
export class Highlight {
  readonly text = input<string>('');
  readonly query = input<string>('');

  protected readonly segments = computed<Segment[]>(() => splitSegments(this.text(), this.query()));
}

function splitSegments(text: string, query: string): Segment[] {
  if (!text || !query) return [{ text, highlighted: false }];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const segments: Segment[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerQuery, cursor);
    if (idx === -1) {
      segments.push({ text: text.slice(cursor), highlighted: false });
      break;
    }
    if (idx > cursor) {
      segments.push({ text: text.slice(cursor, idx), highlighted: false });
    }
    segments.push({
      text: text.slice(idx, idx + query.length),
      highlighted: true,
    });
    cursor = idx + query.length;
  }
  return segments;
}

/** Construit un extrait centré sur la première occurrence de la requête. */
export function snippetAround(
  text: string | null | undefined,
  query: string,
  contextChars = 80,
): string {
  if (!text) return '';
  if (!query) {
    return text.slice(0, contextChars * 2) + (text.length > contextChars * 2 ? '…' : '');
  }
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) {
    return text.slice(0, contextChars * 2) + (text.length > contextChars * 2 ? '…' : '');
  }
  const start = Math.max(0, idx - contextChars / 2);
  const end = Math.min(text.length, idx + query.length + contextChars);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end) + suffix;
}
