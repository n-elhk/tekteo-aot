import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { filter, finalize, switchMap, tap } from 'rxjs';
import { UsersService } from '../../../core/users/users.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ToastService } from '../../../core/notifications/toast.service';
import { Dialog } from '@angular/cdk/dialog';
import { APP_DIALOG_CONFIG } from '../../../core/dialog/dialog.config';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { Card } from '../../../shared/ui/card/card';
import type { AdminUser, Role } from '../../../core/users/user-admin.model';

const ROLES: ReadonlyArray<{ value: Role; label: string }> = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'redacteur', label: 'Rédacteur' },
  { value: 'lecteur', label: 'Lecteur' },
];

/** Liste des utilisateurs avec édition de rôle et suppression. */
@Component({
  selector: 'app-admin-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, DatePipe],
  templateUrl: './admin-users.page.html',
})
export class AdminUsersPage {
  private readonly usersService = inject(UsersService);
  private readonly authStore = inject(AuthStore);
  private readonly toaster = inject(ToastService);
  private readonly dialog = inject(Dialog);

  protected readonly roles = ROLES;
  protected readonly currentUserId = computed(() => this.authStore.user()?.id ?? null);
  protected readonly busyId = signal<string | null>(null);

  protected readonly resource = rxResource({
    stream: () => this.usersService.list(),
  });

  protected readonly users = computed<AdminUser[]>(() => this.resource.value() ?? []);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected onRoleChange(user: AdminUser, value: string): void {
    const newRole = value as Role;
    if (newRole === user.role) return;
    if (user.id === this.currentUserId() && newRole !== 'admin') {
      this.toaster.warning({
        title: 'Action bloquée',
        description: 'Vous ne pouvez pas modifier votre propre rôle.',
      });
      return;
    }
    this.busyId.set(user.id);
    this.usersService.update(user.id, { role: newRole }).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toaster.success({
          title: 'Rôle mis à jour',
          description: `${user.email} → ${labelOf(newRole)}`,
        });
        this.resource.reload();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.toaster.error({
          title: 'Mise à jour impossible',
          description: extractErrorMessage(error),
        });
      },
    });
  }

  protected deleteUser(user: AdminUser): void {
    if (user.id === this.currentUserId()) {
      this.toaster.warning({
        title: 'Action bloquée',
        description: 'Vous ne pouvez pas supprimer votre propre compte.',
      });
      return;
    }
    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      ...APP_DIALOG_CONFIG,
      data: {
        title: 'Supprimer cet utilisateur ?',
        description: `Le compte ${user.email} sera définitivement supprimé.`,
        confirmLabel: 'Supprimer',
        variant: 'danger',
      },
    });

    ref.closed
      .pipe(
        filter(Boolean),
        tap(() => this.busyId.set(user.id)),
        switchMap(() => this.usersService.remove(user.id)),
        tap(() => {
          this.toaster.success({ title: 'Utilisateur supprimé' });
          this.resource.reload();
        }),
        finalize(() => this.busyId.set(null)),
      )
      .subscribe({
        error: (error: unknown) =>
          this.toaster.error({
            title: 'Suppression impossible',
            description: extractErrorMessage(error),
          }),
      });
  }

}

function labelOf(role: Role): string {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { error?: { message?: unknown }; message?: unknown };
    const inner = maybeError.error?.message;
    if (typeof inner === 'string') return inner;
    if (typeof maybeError.message === 'string') return maybeError.message;
  }
  return 'Une erreur inattendue est survenue.';
}
