import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * Zone de dépôt de fichiers purement présentationnelle.
 *
 * Ne fait AUCUNE validation métier (MIME précis, taille, count) :
 * elle se contente d'émettre les fichiers bruts sélectionnés via
 * drag-drop ou via le sélecteur natif. C'est au consommateur de
 * valider, filtrer et afficher d'éventuelles erreurs.
 */
@Component({
  selector: 'app-file-dropzone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      class="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50/60 px-6 py-10 cursor-pointer transition hover:border-brand-400 hover:bg-brand-50/40"
      [class.border-brand-400]="isDraggingOver()"
      [class.bg-brand-50]="isDraggingOver()"
      [class.cursor-not-allowed]="disabled()"
      [class.opacity-50]="disabled()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <svg
        viewBox="0 0 24 24"
        class="h-10 w-10 text-surface-900/30"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"
        />
      </svg>
      <p class="text-sm font-medium text-surface-900">{{ label() }}</p>
      @if (hint()) {
        <p class="text-xs text-surface-900/50">{{ hint() }}</p>
      }
      <input
        type="file"
        class="sr-only"
        [multiple]="multiple()"
        [attr.accept]="accept() || null"
        [disabled]="disabled()"
        (change)="onFilesSelected($event)"
      />
    </label>
  `,
})
export class FileDropzone {
  /** Attribut `accept` natif passé à l'input file (filtre côté sélecteur). */
  readonly accept = input<string>('');
  readonly multiple = input<boolean>(true);
  readonly disabled = input<boolean>(false);
  readonly label = input<string>(
    'Glissez vos fichiers ici, ou cliquez pour parcourir',
  );
  readonly hint = input<string>('');

  readonly filesPicked = output<File[]>();

  protected readonly isDraggingOver = signal(false);

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.emitFiles(Array.from(input.files));
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOver.set(false);
    if (this.disabled()) return;
    const files = event.dataTransfer?.files;
    if (!files) return;
    this.emitFiles(Array.from(files));
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.disabled()) return;
    if (!this.isDraggingOver()) this.isDraggingOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOver.set(false);
  }

  private emitFiles(files: File[]): void {
    if (files.length === 0) return;
    this.filesPicked.emit(files);
  }
}
