import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import type { Section } from '@org/types';
import { SectionsService } from '../../core/sections/sections.service';
import { Dialog } from '@angular/cdk/dialog';
import { APP_DIALOG_CONFIG } from '../../core/dialog/dialog.config';
import { AuthStore } from '../../core/auth/auth.store';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { SectionStatusBadge } from '../../shared/ui/section-status-badge/section-status-badge';
import {
  SectionCreateDialog,
  SectionCreateDialogData,
} from './section-create-dialog';

/**
 * Panneau listant les sections d'un projet AO et permettant d'en créer une.
 *
 * Composant connecté : il consomme {@link SectionsService}.
 * Reçoit `projectId` en input et expose une signature stable pour la page
 * détail projet.
 */
@Component({
  selector: 'app-sections-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button, SectionStatusBadge],
  templateUrl: './sections-panel.html',
})
export class SectionsPanel {
  private readonly sectionsService = inject(SectionsService);
  private readonly dialog = inject(Dialog);
  private readonly authStore = inject(AuthStore);

  readonly projectId = input.required<string>();

  protected readonly canEdit = this.authStore.canEdit;

  protected readonly resource = rxResource({
    params: () => this.projectId(),
    stream: ({ params }) => this.sectionsService.listByProject(params),
  });

  protected readonly sections = computed<Section[]>(() => this.resource.value() ?? []);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected async openCreate(): Promise<void> {
    const ref = this.dialog.open<Section | null, SectionCreateDialogData, SectionCreateDialog>(
      SectionCreateDialog,
      {
        ...APP_DIALOG_CONFIG,
        data: {
          projectId: this.projectId(),
          nextOrderIndex: this.sections().length,
        },
      },
    );
    const created = await firstValueFrom(ref.closed);
    if (created) {
      this.resource.reload();
    }
  }
}
