import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormRoot,
  FormField,
  email,
  form,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { Button } from '../../shared/ui/button/button';
import { AuthService } from '../../core/auth/auth.service';

interface LoginFormModel {
  email: string;
  password: string;
}

/**
 * Page de connexion : visuel marketing à gauche, formulaire à droite.
 * Utilise les Signal Forms d'Angular 21+ (FormRoot + FormField).
 */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormRoot, FormField, RouterLink, Button],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly features: ReadonlyArray<string> = [
    "Analyse IA des appels d'offres",
    'Veille intelligente sur mesure',
    'Gestion collaborative des projets',
  ];

  protected readonly model = signal<LoginFormModel>({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (path) => {
    required(path.email, { message: 'Adresse e-mail requise' });
    email(path.email, { message: 'Adresse e-mail invalide' });
    required(path.password, { message: 'Mot de passe requis' });
    minLength(path.password, 8, { message: 'Au moins 8 caractères' });
  });

  protected readonly serverError = signal<string | null>(null);
  protected readonly canSubmit = computed(
    () => this.loginForm().valid() && !this.loginForm().submitting(),
  );

  protected onSubmit(): void {
    submit(this.loginForm, async () => {
      this.serverError.set(null);
      try {
        await firstValueFrom(this.authService.login(this.model()));
        const redirectTo =
          this.route.snapshot.queryParamMap.get('redirectTo') ?? '/dashboard';
        this.router.navigateByUrl(redirectTo);
      } catch (err: unknown) {
        this.serverError.set(extractErrorMessage(err));
      }
    });
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Connexion impossible. Vérifiez vos identifiants.';
}
