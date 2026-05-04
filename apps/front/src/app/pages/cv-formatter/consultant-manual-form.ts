import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
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

@Component({
  selector: 'app-consultant-manual-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './consultant-manual-form.html',
})
export class ConsultantManualForm {
  private readonly cvsService = inject(ConsultantCvsService);
  private readonly toaster = inject(ToastService);

  protected readonly state = signal<FormState>(structuredClone(EMPTY_STATE));
  protected readonly submitting = signal(false);

  protected readonly fullName = computed(() => {
    const s = this.state();
    return [s.firstName, s.lastName].filter(Boolean).join(' ').trim();
  });

  protected readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      this.fullName().length > 0 &&
      this.state().role.trim().length > 0,
  );

  readonly created = output<void>();

  protected updateField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ): void {
    this.state.update((s) => ({ ...s, [key]: value }));
  }

  // Listes simples (chips)
  protected addSkill(value: string): void {
    const v = value.trim();
    if (!v) return;
    this.state.update((s) => ({ ...s, skills: [...s.skills, v] }));
  }
  protected removeSkill(i: number): void {
    this.state.update((s) => ({
      ...s,
      skills: s.skills.filter((_, idx) => idx !== i),
    }));
  }

  protected addTool(value: string): void {
    const v = value.trim();
    if (!v) return;
    this.state.update((s) => ({ ...s, tools: [...s.tools, v] }));
  }
  protected removeTool(i: number): void {
    this.state.update((s) => ({
      ...s,
      tools: s.tools.filter((_, idx) => idx !== i),
    }));
  }

  protected addLanguage(): void {
    this.state.update((s) => ({
      ...s,
      languages: [...s.languages, { name: '', levelLabel: '' }],
    }));
  }
  protected updateLanguage(i: number, patch: Partial<LanguageEntry>): void {
    this.state.update((s) => ({
      ...s,
      languages: s.languages.map((l, idx) =>
        idx === i ? { ...l, ...patch } : l,
      ),
    }));
  }
  protected removeLanguage(i: number): void {
    this.state.update((s) => ({
      ...s,
      languages: s.languages.filter((_, idx) => idx !== i),
    }));
  }

  protected addCertification(): void {
    this.state.update((s) => ({
      ...s,
      certifications: [...s.certifications, { name: '', year: '' }],
    }));
  }
  protected updateCertification(
    i: number,
    patch: Partial<CertificationEntry>,
  ): void {
    this.state.update((s) => ({
      ...s,
      certifications: s.certifications.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c,
      ),
    }));
  }
  protected removeCertification(i: number): void {
    this.state.update((s) => ({
      ...s,
      certifications: s.certifications.filter((_, idx) => idx !== i),
    }));
  }

  protected addEducation(): void {
    this.state.update((s) => ({
      ...s,
      education: [...s.education, { degree: '', school: '', year: '' }],
    }));
  }
  protected updateEducation(
    i: number,
    patch: Partial<EducationEntry>,
  ): void {
    this.state.update((s) => ({
      ...s,
      education: s.education.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e,
      ),
    }));
  }
  protected removeEducation(i: number): void {
    this.state.update((s) => ({
      ...s,
      education: s.education.filter((_, idx) => idx !== i),
    }));
  }

  protected addExperience(): void {
    this.state.update((s) => ({
      ...s,
      experiences: [
        ...s.experiences,
        { role: '', company: '', dateStart: '', dateEnd: '', mission: '' },
      ],
    }));
  }
  protected updateExperience(
    i: number,
    patch: Partial<ExperienceEntry>,
  ): void {
    this.state.update((s) => ({
      ...s,
      experiences: s.experiences.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e,
      ),
    }));
  }
  protected removeExperience(i: number): void {
    this.state.update((s) => ({
      ...s,
      experiences: s.experiences.filter((_, idx) => idx !== i),
    }));
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    const dto = this.buildDto();

    this.cvsService.create(dto).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toaster.success({
          title: 'Consultant créé',
          description: this.fullName(),
        });
        this.state.set(structuredClone(EMPTY_STATE));
        this.created.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.toaster.error({
          title: 'Création impossible',
          description: extractErrorMessage(err),
        });
      },
    });
  }

  private buildDto(): CreateConsultantCvDto {
    const s = this.state();
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
