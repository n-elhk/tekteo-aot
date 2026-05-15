import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ModalShell } from '../../shared/ui/modal-shell/modal-shell';
import { Button } from '../../shared/ui/button/button';
import type { CreateCvVariantDto } from '../../core/cv-variants/cv-variant.model';
import type { CvTemplateValue } from '@org/schemas';

interface JobProfileOption {
  id: string;
  title: string;
}

export interface CreateVariantDialogData {
  consultantId: string;
  consultantLabel: string;
}

@Component({
  selector: 'app-create-variant-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShell, Button],
  template: `
    <app-modal-shell
      title="Nouvelle variante de CV"
      [subtitle]="'Consultant : ' + data.consultantLabel"
    >
      <div class="flex flex-col gap-4">
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium">Fiche de poste</span>
          <select class="border rounded p-2" [value]="jobProfileId()" (change)="onJobChange($event)">
            <option value="">— Sélectionner —</option>
            @for (j of jobs(); track j.id) {
              <option [value]="j.id">{{ j.title }}</option>
            }
          </select>
        </label>

        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium">Template</span>
          <div class="flex gap-4">
            <label class="flex items-center gap-2">
              <input type="radio" name="tpl" value="tekteo" [checked]="template() === 'tekteo'" (change)="template.set('tekteo')" />
              Tekteo
            </label>
            <label class="flex items-center gap-2">
              <input type="radio" name="tpl" value="anonyme" [checked]="template() === 'anonyme'" (change)="template.set('anonyme')" />
              Anonyme
            </label>
          </div>
        </div>

        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium">Nom (optionnel)</span>
          <input
            class="border rounded p-2"
            [placeholder]="autoNamePreview()"
            [value]="name()"
            (input)="name.set(($any($event.target).value))"
          />
        </label>
      </div>

      <div modalFooter class="flex justify-end gap-2">
        <app-button variant="ghost" (click)="cancel()">Annuler</app-button>
        <app-button variant="primary" [disabled]="!canSubmit()" (click)="submit()">Créer</app-button>
      </div>
    </app-modal-shell>
  `,
})
export class CreateVariantDialog {
  protected readonly data = inject<CreateVariantDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<CreateCvVariantDto>>(DialogRef);
  private readonly http = inject(HttpClient);

  protected readonly jobs = signal<JobProfileOption[]>([]);
  protected readonly jobProfileId = signal<string>('');
  protected readonly template = signal<CvTemplateValue>('tekteo');
  protected readonly name = signal<string>('');

  protected readonly canSubmit = computed(() => this.jobProfileId().length > 0);

  protected readonly autoNamePreview = computed(() => {
    const job = this.jobs().find((j) => j.id === this.jobProfileId());
    const label = this.template() === 'tekteo' ? 'Tekteo' : 'Anonyme';
    if (!job) return `<titre du job> — ${label} — auto`;
    return `${job.title} — ${label} — auto`;
  });

  constructor() {
    void this.loadJobs();
  }

  private async loadJobs() {
    const list = await firstValueFrom(
      this.http.get<{ items: JobProfileOption[] } | JobProfileOption[]>('/api/job-profiles'),
    );
    const items = Array.isArray(list) ? list : list.items;
    this.jobs.set(items.map((j) => ({ id: j.id, title: j.title })));
  }

  protected onJobChange(ev: Event) {
    this.jobProfileId.set(((ev.target as HTMLSelectElement).value) ?? '');
  }

  protected cancel() {
    this.dialogRef.close();
  }

  protected submit() {
    if (!this.canSubmit()) return;
    const dto: CreateCvVariantDto = {
      jobProfileId: this.jobProfileId(),
      template: this.template(),
      ...(this.name().trim() ? { name: this.name().trim() } : {}),
    };
    this.dialogRef.close(dto);
  }
}
