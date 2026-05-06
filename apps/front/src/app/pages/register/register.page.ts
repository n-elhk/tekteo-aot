import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormRoot,
  FormField,
  email,
  form,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { Button } from '../../shared/ui/button/button';
import { AuthService } from '../../core/auth/auth.service';

interface RegisterFormModel {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormRoot, FormField, RouterLink, Button],
  templateUrl: './register.page.html',
})
export class RegisterPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly features: ReadonlyArray<string> = [
    "Analyse IA des appels d'offres",
    'Veille intelligente sur mesure',
    'Gestion collaborative des projets',
  ];

  protected readonly model = signal<RegisterFormModel>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  protected readonly serverError = signal<string | null>(null);

  protected readonly registerForm = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Nom requis' });
      minLength(path.name, 2, { message: 'Au moins 2 caractères' });
      maxLength(path.name, 80, { message: 'Au maximum 80 caractères' });
      required(path.email, { message: 'Adresse e-mail requise' });
      email(path.email, { message: 'Adresse e-mail invalide' });
      required(path.password, { message: 'Mot de passe requis' });
      minLength(path.password, 8, { message: 'Au moins 8 caractères' });
      required(path.confirmPassword, { message: 'Confirmation requise' });
      validate(path.confirmPassword, ({ value, valueOf }) =>
        value() && value() !== valueOf(path.password)
          ? {
              kind: 'passwordMismatch',
              message: 'Les mots de passe ne correspondent pas',
            }
          : undefined,
      );
    },
    {
      submission: {
        action: async () => {
          this.serverError.set(null);
          try {
            const { name, email, password } = this.model();
            await firstValueFrom(this.authService.register({ name, email, password }));
            this.router.navigateByUrl('/dashboard');
            return undefined;
          } catch (err: unknown) {
            this.serverError.set(extractErrorMessage(err));
            return undefined;
          }
        },
        onInvalid: (field) => {
          field().markAsTouched();
        },
      },
    },
  );

  protected readonly canSubmit = computed(
    () => this.registerForm().valid() && !this.registerForm().submitting(),
  );

  protected onSubmit(): void {
    void submit(this.registerForm);
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return "Inscription impossible. Vérifiez vos informations.";
}
