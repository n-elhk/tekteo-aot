import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import {
  applyEach,
  email,
  form,
  FormField,
  FormRoot,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { ConsultantCvsService } from '../../core/consultant-cvs/consultant-cvs.service';
import type { CreateConsultantCvDto } from '../../core/consultant-cvs/consultant-cv.model';
import { ToastService } from '../../core/notifications/toast.service';
import { Button } from '../../shared/ui/button/button';

interface ExperienceEntry {
  role: string;
  company: string;
  dateStart: string;
  dateEnd: string;
  mission: string;
}

interface EducationEntry {
  degree: string;
  school: string;
  year: string;
}

interface CertificationEntry {
  name: string;
  year: string;
}

interface LanguageEntry {
  name: string;
  levelLabel: string;
}

interface FormState {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  tools: string[];
  languages: LanguageEntry[];
  certifications: CertificationEntry[];
  education: EducationEntry[];
  experiences: ExperienceEntry[];
}

const EMPTY_STATE: FormState = {
  firstName: '',
  lastName: '',
  role: '',
  email: '',
  phone: '',
  location: '',
  summary: '',
  skills: [],
  tools: [],
  languages: [],
  certifications: [],
  education: [],
  experiences: [],
};

const blankOnly = (value: string) =>
  value.length > 0 && value.trim().length === 0
    ? { kind: 'blank', message: 'Ne peut contenir que des espaces' }
    : undefined;

@Component({
  selector: 'app-consultant-manual-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, FormRoot, FormField],
  templateUrl: './consultant-manual-form.html',
})
export class ConsultantManualForm {
  private readonly cvsService = inject(ConsultantCvsService);
  private readonly toaster = inject(ToastService);

  readonly created = output<void>();

  protected readonly model = signal<FormState>(structuredClone(EMPTY_STATE));

  protected readonly consultantForm = form(
    this.model,
    (path) => {
      required(path.firstName, { message: 'Prénom requis' });
      maxLength(path.firstName, 80, { message: 'Au maximum 80 caractères' });
      validate(path.firstName, ({ value }) => blankOnly(value()));

      required(path.lastName, { message: 'Nom requis' });
      maxLength(path.lastName, 80, { message: 'Au maximum 80 caractères' });
      validate(path.lastName, ({ value }) => blankOnly(value()));

      required(path.role, { message: "L'intitulé du poste est requis" });
      minLength(path.role, 2, { message: 'Au moins 2 caractères' });
      maxLength(path.role, 150, { message: 'Au maximum 150 caractères' });
      validate(path.role, ({ value }) => blankOnly(value()));

      email(path.email, { message: 'Adresse e-mail invalide' });
      maxLength(path.email, 200, { message: 'Au maximum 200 caractères' });
      maxLength(path.phone, 50, { message: 'Au maximum 50 caractères' });
      maxLength(path.location, 200, { message: 'Au maximum 200 caractères' });
      maxLength(path.summary, 2000, { message: 'Au maximum 2 000 caractères' });

      applyEach(path.languages, (lang) => {
        required(lang.name, { message: 'Langue requise' });
        maxLength(lang.name, 80, { message: 'Au maximum 80 caractères' });
        maxLength(lang.levelLabel, 80, { message: 'Au maximum 80 caractères' });
      });

      applyEach(path.certifications, (cert) => {
        required(cert.name, { message: 'Nom requis' });
        maxLength(cert.name, 200, { message: 'Au maximum 200 caractères' });
        maxLength(cert.year, 10, { message: 'Au maximum 10 caractères' });
      });

      applyEach(path.education, (edu) => {
        required(edu.degree, { message: 'Diplôme requis' });
        required(edu.school, { message: 'École requise' });
        maxLength(edu.degree, 200, { message: 'Au maximum 200 caractères' });
        maxLength(edu.school, 200, { message: 'Au maximum 200 caractères' });
        maxLength(edu.year, 10, { message: 'Au maximum 10 caractères' });
      });

      applyEach(path.experiences, (exp) => {
        required(exp.role, { message: 'Rôle requis' });
        required(exp.company, { message: 'Entreprise requise' });
        maxLength(exp.role, 200, { message: 'Au maximum 200 caractères' });
        maxLength(exp.company, 200, { message: 'Au maximum 200 caractères' });
        maxLength(exp.dateStart, 50, { message: 'Au maximum 50 caractères' });
        maxLength(exp.dateEnd, 50, { message: 'Au maximum 50 caractères' });
        maxLength(exp.mission, 4000, { message: 'Au maximum 4 000 caractères' });
      });
    },
    {
      submission: {
        action: async () => {
          try {
            await firstValueFrom(this.cvsService.create(this.buildDto()));
            this.toaster.success({
              title: 'Consultant créé',
              description: this.fullName(),
            });
            this.model.set(structuredClone(EMPTY_STATE));
            this.created.emit();
            return undefined;
          } catch (err: unknown) {
            this.toaster.error({
              title: 'Création impossible',
              description: extractErrorMessage(err),
            });
            return undefined;
          }
        },
        onInvalid: (field) => {
          field().markAsTouched();
        },
      },
    },
  );

  protected readonly fullName = computed(() => {
    const s = this.model();
    return [s.firstName, s.lastName].filter(Boolean).join(' ').trim();
  });

  // Listes de chips (skills/tools) — gérées hors form, ajout via Entrée.
  protected addSkill(value: string): void {
    const v = value.trim();
    if (!v) return;
    this.model.update((s) => ({ ...s, skills: [...s.skills, v] }));
  }
  protected removeSkill(i: number): void {
    this.model.update((s) => ({
      ...s,
      skills: s.skills.filter((_, idx) => idx !== i),
    }));
  }

  protected addTool(value: string): void {
    const v = value.trim();
    if (!v) return;
    this.model.update((s) => ({ ...s, tools: [...s.tools, v] }));
  }
  protected removeTool(i: number): void {
    this.model.update((s) => ({
      ...s,
      tools: s.tools.filter((_, idx) => idx !== i),
    }));
  }

  protected addLanguage(): void {
    this.model.update((s) => ({
      ...s,
      languages: [...s.languages, { name: '', levelLabel: '' }],
    }));
  }
  protected removeLanguage(i: number): void {
    this.model.update((s) => ({
      ...s,
      languages: s.languages.filter((_, idx) => idx !== i),
    }));
  }

  protected addCertification(): void {
    this.model.update((s) => ({
      ...s,
      certifications: [...s.certifications, { name: '', year: '' }],
    }));
  }
  protected removeCertification(i: number): void {
    this.model.update((s) => ({
      ...s,
      certifications: s.certifications.filter((_, idx) => idx !== i),
    }));
  }

  protected addEducation(): void {
    this.model.update((s) => ({
      ...s,
      education: [...s.education, { degree: '', school: '', year: '' }],
    }));
  }
  protected removeEducation(i: number): void {
    this.model.update((s) => ({
      ...s,
      education: s.education.filter((_, idx) => idx !== i),
    }));
  }

  protected addExperience(): void {
    this.model.update((s) => ({
      ...s,
      experiences: [
        ...s.experiences,
        { role: '', company: '', dateStart: '', dateEnd: '', mission: '' },
      ],
    }));
  }
  protected removeExperience(i: number): void {
    this.model.update((s) => ({
      ...s,
      experiences: s.experiences.filter((_, idx) => idx !== i),
    }));
  }

  protected onSubmit(): void {
    void submit(this.consultantForm);
  }

  private buildDto(): CreateConsultantCvDto {
    const s = this.model();
    return {
      consultantName: this.fullName(),
      consultantTitle: s.role.trim(),
      cvData: {
        identity: {
          firstName: s.firstName.trim(),
          lastName: s.lastName.trim(),
          role: s.role.trim(),
          email: s.email.trim(),
          phone: s.phone.trim(),
          location: s.location.trim(),
          summary: s.summary.trim(),
        },
        skills: s.skills.map((name) => ({ name })),
        tools: s.tools,
        languages: s.languages,
        certifications: s.certifications,
        education: s.education,
        experiences: s.experiences,
      },
    };
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { error?: { message?: unknown }; message?: unknown };
    if (typeof e.error?.message === 'string') return e.error.message;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Une erreur inattendue est survenue.';
}
