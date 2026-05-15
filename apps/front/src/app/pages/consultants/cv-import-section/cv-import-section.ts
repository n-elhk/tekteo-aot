import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  catchError,
  map,
  merge,
  of,
  scan,
  startWith,
  takeWhile,
  tap,
} from 'rxjs';
import {
  ConsultantsService,
  type ConsultantImportJobEvent,
} from '../../../core/consultants/consultants.service';
import { ToastService } from '../../../core/notifications/toast.service';
import { Button } from '../../../shared/ui/button/button';
import { FileDropzone } from '../../../shared/ui/file-dropzone/file-dropzone';

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.docx']);
const IMPORT_ACCEPT_ATTR =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;

type FileStatus = 'idle' | 'pending' | 'processing' | 'done' | 'failed';

interface FileEntry {
  readonly localId: string;
  readonly file: File;
  readonly jobId: string | null;
  readonly status: FileStatus;
  readonly consultantId: string | null;
  readonly error: string | null;
}

interface WatchedJob {
  readonly localId: string;
  readonly jobId: string;
}

interface JobPatch {
  readonly status?: FileStatus;
  readonly consultantId?: string | null;
  readonly error?: string | null;
}

type JobPatches = Readonly<Record<string, JobPatch>>;

/**
 * Section "Importer un document" : capture les fichiers via le dropzone partagé,
 * fait la requête bulk d'import puis suit la progression de chaque job via SSE.
 *
 * Émet `imported` une fois par cycle d'import, à la fin.
 */
@Component({
  selector: 'app-cv-import-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, FileDropzone, RouterLink],
  templateUrl: './cv-import-section.html',
})
export class CvImportSection {
  private readonly consultants = inject(ConsultantsService);
  private readonly toaster = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly imported = output<void>();

  protected readonly importAcceptAttr = IMPORT_ACCEPT_ATTR;

  /** Liste des fichiers contrôlée par l'utilisateur (ajout/suppression). */
  private readonly baseEntries = signal<readonly FileEntry[]>([]);

  /** Jobs SSE à surveiller — rempli au submit, vidé à chaque nouvelle tentative. */
  private readonly jobsToWatch = signal<readonly WatchedJob[]>([]);

  /** Patches accumulés à partir des flux SSE de chaque job. */
  protected readonly jobPatches = rxResource<JobPatches, readonly WatchedJob[]>(
    {
      defaultValue: {},
      params: () => this.jobsToWatch(),
      stream: ({ params: jobs }) => {
        if (jobs.length === 0) {
          return of<JobPatches>({});
        }
        return merge(
          ...jobs.map(({ jobId, localId }) =>
            this.consultants.watchImportJob(jobId).pipe(
              map((update) => ({ localId, patch: toJobPatch(update) })),
              takeWhile(
                ({ patch }) =>
                  patch.status !== 'done' && patch.status !== 'failed',
                true,
              ),
              catchError(() =>
                of({
                  localId,
                  patch: {
                    status: 'failed',
                    error: 'Connexion perdue',
                  } satisfies JobPatch,
                }),
              ),
            ),
          ),
        ).pipe(
          scan<
            { localId: string; patch: JobPatch },
            Record<string, JobPatch>
          >(
            (state, { localId, patch }) => ({
              ...state,
              [localId]: { ...state[localId], ...patch },
            }),
            {},
          ),
          startWith<JobPatches>({}),
        );
      },
    },
  );

  /** Vue fusionnée : entries de base + patches venus du SSE. */
  protected readonly entries = computed<readonly FileEntry[]>(() => {
    const patches = this.jobPatches.value();
    return this.baseEntries().map((entry) => ({
      ...entry,
      ...patches[entry.localId],
    }));
  });

  /**
   * Dérivé des entrées (writable pour les overrides transitoires) :
   * - `set(true)` entre le clic submit et la réponse HTTP
   * - `set(false)` en cas d'erreur HTTP
   */
  protected readonly running = linkedSignal<readonly FileEntry[], boolean>({
    source: () => this.entries(),
    computation: (entries) =>
      entries.some((e) => e.status === 'pending' || e.status === 'processing'),
  });

  protected readonly canSubmit = computed(
    () => !this.running() && this.baseEntries().length > 0,
  );

  private readonly allDone = computed(() => {
    const list = this.entries();
    return (
      list.length > 0 &&
      list.every((e) => e.status === 'done' || e.status === 'failed')
    );
  });

  private completedEmitted = false;

  constructor() {
    // Émission de `imported` une fois par cycle d'import.
    effect(() => {
      if (!this.allDone()) {
        this.completedEmitted = false;
        return;
      }
      if (this.completedEmitted) return;
      this.completedEmitted = true;
      untracked(() => this.imported.emit());
    });
  }

  protected onFilesPicked(files: File[]): void {
    if (this.running()) return;

    const existing = this.baseEntries();
    const accepted: FileEntry[] = [];

    for (const file of files) {
      if (existing.length + accepted.length >= MAX_FILES) {
        this.toaster.error({
          title: 'Trop de fichiers',
          description: `Maximum ${MAX_FILES} fichiers par import.`,
        });
        break;
      }
      if (!this.isAccepted(file)) continue;
      if (file.size > MAX_FILE_SIZE) {
        this.toaster.error({
          title: 'Fichier trop volumineux',
          description: `${file.name} dépasse la limite de 10 Mo.`,
        });
        continue;
      }
      accepted.push({
        localId: crypto.randomUUID(),
        file,
        jobId: null,
        status: 'idle',
        consultantId: null,
        error: null,
      });
    }

    if (accepted.length > 0) {
      this.baseEntries.update((list) => [...list, ...accepted]);
    }
  }

  protected removeEntry(localId: string): void {
    if (this.running()) return;
    this.baseEntries.update((l) => l.filter((e) => e.localId !== localId));
  }

  protected submit(): void {
    if (!this.canSubmit()) return;

    const snapshot = this.baseEntries();
    const files = snapshot.map((e) => e.file);

    this.running.set(true);
    this.jobsToWatch.set([]);

    this.consultants
      .importFromFile(files)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(({ jobs }) => {
          this.baseEntries.update((list) =>
            list.map((entry, i) => {
              const job = jobs[i];
              return {
                ...entry,
                jobId: job?.jobId ?? null,
                status: (job ? 'pending' : 'failed') satisfies FileStatus,
                error: job ? null : 'Aucun job reçu pour ce fichier.',
              };
            }),
          );

          const watched: WatchedJob[] = [];
          for (let i = 0; i < jobs.length; i++) {
            const entry = snapshot[i];
            const job = jobs[i];
            if (entry && job) {
              watched.push({ localId: entry.localId, jobId: job.jobId });
            }
          }
          this.jobsToWatch.set(watched);
        }),
        catchError((err: unknown) => {
          this.running.set(false);
          this.toaster.error({
            title: 'Import impossible',
            description: extractErrorMessage(err),
          });
          return of(null);
        }),
      )
      .subscribe();
  }

  private isAccepted(file: File): boolean {
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (!ACCEPTED_MIME_TYPES.has(file.type) && !ACCEPTED_EXTENSIONS.has(ext)) {
      this.toaster.error({
        title: 'Format non supporté',
        description: `${file.name} : seuls PDF et DOCX sont acceptés.`,
      });
      return false;
    }
    return true;
  }
}

// -----------------------------------------------------------
// Helpers purs
// -----------------------------------------------------------

function toJobPatch(update: Partial<ConsultantImportJobEvent>): JobPatch {
  const patch: { -readonly [K in keyof JobPatch]: JobPatch[K] } = {};
  if (update.status) {
    patch.status = update.status as FileStatus;
  }
  if (update.consultantId !== undefined) {
    patch.consultantId = update.consultantId;
  }
  if (update.error !== undefined) {
    patch.error = update.error;
  }
  return patch;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { error?: { message?: unknown }; message?: unknown };
    if (typeof e.error?.message === 'string') return e.error.message;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Une erreur inattendue est survenue.';
}
