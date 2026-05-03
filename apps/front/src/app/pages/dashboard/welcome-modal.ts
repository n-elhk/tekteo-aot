import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { ModalShell } from '../../shared/ui/modal-shell/modal-shell';
import { Button } from '../../shared/ui/button/button';

/**
 * Boîte de dialogue de démonstration ouverte depuis le tableau de bord.
 * Sert d'exemple d'intégration `@angular/cdk/dialog` + {@link ModalShell}.
 */
@Component({
  selector: 'app-welcome-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShell, Button],
  template: `
    <app-modal-shell
      title="Bienvenue sur Tekteo 🎉"
      subtitle="Découvrez les nouveautés de la plateforme migrée vers Angular 21."
    >
      <ul class="space-y-2 text-sm leading-relaxed">
        <li class="flex gap-2">
          <span aria-hidden="true">✨</span>
          <span>Mode <strong>zoneless</strong> pour des rendus plus rapides.</span>
        </li>
        <li class="flex gap-2">
          <span aria-hidden="true">🧱</span>
          <span>Tous les composants en <strong>OnPush</strong> avec signaux.</span>
        </li>
        <li class="flex gap-2">
          <span aria-hidden="true">🪟</span>
          <span>Boîtes de dialogue accessibles avec <strong>@angular/cdk/dialog</strong>.</span>
        </li>
        <li class="flex gap-2">
          <span aria-hidden="true">📝</span>
          <span>Formulaires modernes via <strong>Signal Forms</strong>.</span>
        </li>
      </ul>

      <div modalFooter class="flex justify-end gap-2">
        <app-button variant="ghost" (click)="close('later')">Plus tard</app-button>
        <app-button variant="primary" (click)="close('ok')">C'est parti !</app-button>
      </div>
    </app-modal-shell>
  `,
})
export class WelcomeModal {
  private readonly dialogRef = inject(DialogRef<string, WelcomeModal>);

  protected close(result: 'ok' | 'later'): void {
    this.dialogRef.close(result);
  }
}
