import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormField,
  FormRoot,
  form,
  maxLength,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import type { CreateProjectDto } from '@org/schemas';
import { ProjectsService } from '../../core/projects/projects.service';
import { ToastService } from '../../core/notifications/toast.service';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';

interface ProjectFormModel {
  name: string;
  clientName: string;
  marketReference: string;
  marketObject: string;
  deadline: string;
  durationMonths: string;
}

const EMPTY_MODEL: ProjectFormModel = {
  name: '',
  clientName: '',
  marketReference: '',
  marketObject: '',
  deadline: '',
  durationMonths: '',
};

/**
 * Formulaire de création d'un projet AO.
 * Utilise Signal Forms et POST `/api/projects`.
 *
 * Le mot-clé `email` du package est aliasé pour éviter le conflit avec
 * un champ nommé `email` (non utilisé ici, mais convention partagée).
 */
@Component({
  selector: 'app-project-new-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormRoot, FormField, RouterLink, Card, Button],
  templateUrl: './project-new.page.html',
})
export class ProjectNewPage {
  private readonly projectsService = inject(ProjectsService);
  private readonly toaster = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly model = signal<ProjectFormModel>({ ...EMPTY_MODEL });
  protected readonly projectForm = form(this.model, (path) => {
    required(path.name, { message: 'Le nom du projet est requis' });
    minLength(path.name, 2, { message: 'Au moins 2 caractères' });
    maxLength(path.name, 200, { message: 'Au maximum 200 caractères' });
    required(path.clientName, { message: 'Le client est requis' });
    minLength(path.clientName, 2, { message: 'Au moins 2 caractères' });
    maxLength(path.clientName, 200, { message: 'Au maximum 200 caractères' });
    maxLength(path.marketReference, 100, { message: 'Au maximum 100 caractères' });
    maxLength(path.marketObject, 2000, { message: 'Au maximum 2 000 caractères' });
  });

  protected readonly canSubmit = computed(
    () => this.projectForm().valid() && !this.projectForm().submitting(),
  );

  protected onSubmit(): void {
    submit(this.projectForm, async () => {
      const dto = toCreateProjectDto(this.model());
      try {
        const project = await firstValueFrom(this.projectsService.create(dto));
        this.toaster.success({
          title: 'Projet créé',
          description: `« ${project.name} » est prêt à être configuré.`,
        });
        this.router.navigate(['/projects', project.id]);
      } catch (error: unknown) {
        this.toaster.error({
          title: 'Création impossible',
          description: extractErrorMessage(error),
        });
      }
    });
  }
}

function toCreateProjectDto(model: ProjectFormModel): CreateProjectDto {
  const trimmedReference = model.marketReference.trim();
  const trimmedObject = model.marketObject.trim();
  const trimmedDeadline = model.deadline.trim();
  const duration = parseInt(model.durationMonths, 10);

  return {
    name: model.name.trim(),
    clientName: model.clientName.trim(),
    technologies: [],
    lots: [],
    status: 'brouillon',
    ...(trimmedReference ? { marketReference: trimmedReference } : {}),
    ...(trimmedObject ? { marketObject: trimmedObject } : {}),
    ...(trimmedDeadline ? { deadline: trimmedDeadline } : {}),
    ...(Number.isFinite(duration) && duration > 0 ? { durationMonths: duration } : {}),
  };
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
