import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  SectionTemplate,
  SectionTemplatesService,
} from '../../../core/section-templates/section-templates.service';
import { AppDialogService } from '../../../core/dialog/app-dialog.service';
import { ToastService } from '../../../core/notifications/toast.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import {
  TemplateEditDialog,
  TemplateEditDialogData,
} from './template-edit-dialog';

/** Liste + CRUD des modèles de section. */
@Component({
  selector: 'app-admin-section-templates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button],
  templateUrl: './admin-section-templates.page.html',
})
export class AdminSectionTemplatesPage {
  private readonly service = inject(SectionTemplatesService);
  private readonly dialog = inject(AppDialogService);
  private readonly toaster = inject(ToastService);
  private readonly authStore = inject(AuthStore);

  protected readonly isAdmin = this.authStore.isAdmin;

  protected readonly resource = rxResource({
    stream: () => this.service.list(),
  });

  protected readonly templates = computed<SectionTemplate[]>(() => this.resource.value() ?? []);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected async openCreate(): Promise<void> {
    await this.openDialog(null);
  }

  protected async openEdit(template: SectionTemplate): Promise<void> {
    await this.openDialog(template);
  }

  protected async deleteTemplate(template: SectionTemplate): Promise<void> {
    const ref = this.dialog.open<ConfirmDialog, void, boolean>(ConfirmDialog, {
      data: undefined,
      providers: [
        {
          provide: ConfirmDialog.DATA,
          useValue: {
            title: 'Supprimer ce modèle ?',
            description: `« ${template.name} » sera définitivement supprimé.`,
            confirmLabel: 'Supprimer',
            variant: 'danger' as const,
          },
        },
      ],
    });
    const confirmed = await firstValueFrom(ref.closed);
    if (!confirmed) return;
    this.service.remove(template.id).subscribe({
      next: () => {
        this.toaster.success({ title: 'Modèle supprimé' });
        this.resource.reload();
      },
      error: () =>
        this.toaster.error({
          title: 'Suppression impossible',
          description: 'Veuillez réessayer dans un instant.',
        }),
    });
  }

  private async openDialog(template: SectionTemplate | null): Promise<void> {
    const ref = this.dialog.open<TemplateEditDialog, void, SectionTemplate | null>(
      TemplateEditDialog,
      {
        data: undefined,
        providers: [
          {
            provide: TemplateEditDialog.DATA,
            useValue: {
              template,
              nextOrderIndex: this.templates().length,
            } satisfies TemplateEditDialogData,
          },
        ],
      },
    );
    const saved = await firstValueFrom(ref.closed);
    if (saved) this.resource.reload();
  }
}
