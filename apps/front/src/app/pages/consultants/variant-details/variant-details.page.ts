import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  applyEach,
  form,
  FormField,
  FormRoot,
  max,
  min,
  submit,
} from '@angular/forms/signals';
import type { CvData } from '@org/schemas';
import { VariantDetailsStore } from './variant-details.store';
import { CvVariantsService } from '../../../core/cv-variants/cv-variants.service';
import { Button } from '../../../shared/ui/button/button';
import { ToastService } from '../../../core/notifications/toast.service';

interface IdentityState {
  firstName: string;
  lastName: string;
  initials: string;
  role: string;
  subtitle: string;
  summary: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
}

interface SkillEntry {
  name: string;
  level: number | null;
}

interface LanguageEntry {
  name: string;
  levelLabel: string;
  dots: number | null;
}

interface CertificationEntry {
  name: string;
  year: string;
}

interface EducationEntry {
  degree: string;
  year: string;
  school: string;
}

interface ContextEntry {
  team: string;
  methodology: string;
  role: string;
  extraLabel: string;
  extraValue: string;
}

interface ActivityEntry {
  bold: string;
  text: string;
}

interface ResultEntry {
  value: string;
  label: string;
}

interface TechEntry {
  category: string;
  items: string;
}

interface ExperienceEntry {
  role: string;
  company: string;
  clientMeta: string;
  dateStart: string;
  dateEnd: string;
  duration: string;
  location: string;
  context: ContextEntry;
  mission: string;
  activities: ActivityEntry[];
  results: ResultEntry[];
  tech: TechEntry[];
}

interface FormState {
  identity: IdentityState;
  skills: SkillEntry[];
  tools: string[];
  languages: LanguageEntry[];
  certifications: CertificationEntry[];
  education: EducationEntry[];
  experiences: ExperienceEntry[];
}

const EMPTY_IDENTITY: IdentityState = {
  firstName: '',
  lastName: '',
  initials: '',
  role: '',
  subtitle: '',
  summary: '',
  email: '',
  phone: '',
  location: '',
  linkedin: '',
};

const EMPTY_CONTEXT: ContextEntry = {
  team: '',
  methodology: '',
  role: '',
  extraLabel: '',
  extraValue: '',
};

const EMPTY_STATE: FormState = {
  identity: { ...EMPTY_IDENTITY },
  skills: [],
  tools: [],
  languages: [],
  certifications: [],
  education: [],
  experiences: [],
};

const emptyExperience = (): ExperienceEntry => ({
  role: '',
  company: '',
  clientMeta: '',
  dateStart: '',
  dateEnd: '',
  duration: '',
  location: '',
  context: { ...EMPTY_CONTEXT },
  mission: '',
  activities: [],
  results: [],
  tech: [],
});

@Component({
  selector: 'app-variant-details',
  imports: [RouterLink, DatePipe, FormRoot, FormField, Button],
  providers: [VariantDetailsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './variant-details.page.html',
})
export class VariantDetailsPage {
  protected readonly store = inject(VariantDetailsStore);
  private readonly api = inject(CvVariantsService);
  private readonly toaster = inject(ToastService);

  protected readonly nameDraft = linkedSignal<string>(
    () => this.store.variant()?.name ?? '',
  );
  protected readonly model = linkedSignal<FormState>(() => {
    const v = this.store.variant();
    return v ? toFormState(v.cvData) : structuredClone(EMPTY_STATE);
  });

  protected readonly backLink = computed(() => {
    const v = this.store.variant();
    return v ? ['/consultants', v.consultantId] : ['/consultants'];
  });

  protected readonly cvForm = form(
    this.model,
    (path) => {
      applyEach(path.skills, (skill) => {
        min(skill.level, 0, { message: 'Niveau >= 0' });
        max(skill.level, 5, { message: 'Niveau <= 5' });
      });
      applyEach(path.languages, (lang) => {
        min(lang.dots, 0, { message: 'Niveau >= 0' });
        max(lang.dots, 5, { message: 'Niveau <= 5' });
      });
    },
    {
      submission: {
        action: async () => {
          try {
            const payload = this.buildCvData();
            this.store.saveCvData(payload);
            this.toaster.success({ title: 'Variante enregistrée' });
            return undefined;
          } catch (err: unknown) {
            this.toaster.error({
              title: 'Enregistrement impossible',
              description: extractErrorMessage(err),
            });
            return undefined;
          }
        },
      },
    },
  );

  protected saveName(): void {
    const name = this.nameDraft().trim();
    if (!name) return;
    const current = this.store.variant();
    if (!current || current.name === name) return;
    this.store.saveName(name);
  }

  protected onSubmit(): void {
    void submit(this.cvForm);
  }

  protected downloadUrl(variantId: string, genId: string): string {
    return this.api.downloadPdfUrl(variantId, genId);
  }

  // ----- Skills -----
  protected addSkill(): void {
    this.model.update((s) => ({
      ...s,
      skills: [...s.skills, { name: '', level: null }],
    }));
  }
  protected removeSkill(i: number): void {
    this.model.update((s) => ({
      ...s,
      skills: s.skills.filter((_, idx) => idx !== i),
    }));
  }

  // ----- Tools (chips) -----
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

  // ----- Languages -----
  protected addLanguage(): void {
    this.model.update((s) => ({
      ...s,
      languages: [...s.languages, { name: '', levelLabel: '', dots: null }],
    }));
  }
  protected removeLanguage(i: number): void {
    this.model.update((s) => ({
      ...s,
      languages: s.languages.filter((_, idx) => idx !== i),
    }));
  }

  // ----- Certifications -----
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

  // ----- Education -----
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

  // ----- Experiences -----
  protected addExperience(): void {
    this.model.update((s) => ({
      ...s,
      experiences: [...s.experiences, emptyExperience()],
    }));
  }
  protected removeExperience(i: number): void {
    this.model.update((s) => ({
      ...s,
      experiences: s.experiences.filter((_, idx) => idx !== i),
    }));
  }

  // ----- Experience sub-arrays -----
  protected addActivity(expIdx: number): void {
    this.model.update((s) => ({
      ...s,
      experiences: s.experiences.map((exp, idx) =>
        idx === expIdx
          ? { ...exp, activities: [...exp.activities, { bold: '', text: '' }] }
          : exp,
      ),
    }));
  }
  protected removeActivity(expIdx: number, i: number): void {
    this.model.update((s) => ({
      ...s,
      experiences: s.experiences.map((exp, idx) =>
        idx === expIdx
          ? {
              ...exp,
              activities: exp.activities.filter((_, j) => j !== i),
            }
          : exp,
      ),
    }));
  }

  protected addResult(expIdx: number): void {
    this.model.update((s) => ({
      ...s,
      experiences: s.experiences.map((exp, idx) =>
        idx === expIdx
          ? { ...exp, results: [...exp.results, { value: '', label: '' }] }
          : exp,
      ),
    }));
  }
  protected removeResult(expIdx: number, i: number): void {
    this.model.update((s) => ({
      ...s,
      experiences: s.experiences.map((exp, idx) =>
        idx === expIdx
          ? { ...exp, results: exp.results.filter((_, j) => j !== i) }
          : exp,
      ),
    }));
  }

  protected addTech(expIdx: number): void {
    this.model.update((s) => ({
      ...s,
      experiences: s.experiences.map((exp, idx) =>
        idx === expIdx
          ? { ...exp, tech: [...exp.tech, { category: '', items: '' }] }
          : exp,
      ),
    }));
  }
  protected removeTech(expIdx: number, i: number): void {
    this.model.update((s) => ({
      ...s,
      experiences: s.experiences.map((exp, idx) =>
        idx === expIdx
          ? { ...exp, tech: exp.tech.filter((_, j) => j !== i) }
          : exp,
      ),
    }));
  }

  private buildCvData(): CvData {
    const s = this.model();
    return {
      ...(hasAnyIdentity(s.identity)
        ? { identity: compactIdentity(s.identity) }
        : {}),
      ...(s.skills.length
        ? {
            skills: s.skills
              .filter((sk) => sk.name.trim().length > 0)
              .map((sk) => ({
                name: sk.name.trim(),
                ...(sk.level !== null && !Number.isNaN(sk.level)
                  ? { level: sk.level }
                  : {}),
              })),
          }
        : {}),
      ...(s.tools.length ? { tools: [...s.tools] } : {}),
      ...(s.languages.length
        ? {
            languages: s.languages
              .filter((l) => l.name.trim().length > 0)
              .map((l) => ({
                name: l.name.trim(),
                ...(l.levelLabel.trim()
                  ? { levelLabel: l.levelLabel.trim() }
                  : {}),
                ...(l.dots !== null && !Number.isNaN(l.dots)
                  ? { dots: l.dots }
                  : {}),
              })),
          }
        : {}),
      ...(s.certifications.length
        ? {
            certifications: s.certifications
              .filter((c) => c.name.trim().length > 0)
              .map((c) => ({
                name: c.name.trim(),
                ...(c.year.trim() ? { year: c.year.trim() } : {}),
              })),
          }
        : {}),
      ...(s.education.length
        ? {
            education: s.education.map((e) => ({
              ...(e.degree.trim() ? { degree: e.degree.trim() } : {}),
              ...(e.school.trim() ? { school: e.school.trim() } : {}),
              ...(e.year.trim() ? { year: e.year.trim() } : {}),
            })),
          }
        : {}),
      ...(s.experiences.length
        ? { experiences: s.experiences.map(compactExperience) }
        : {}),
    };
  }
}

function toFormState(data: CvData | null | undefined): FormState {
  if (!data) return structuredClone(EMPTY_STATE);
  return {
    identity: {
      firstName: data.identity?.firstName ?? '',
      lastName: data.identity?.lastName ?? '',
      initials: data.identity?.initials ?? '',
      role: data.identity?.role ?? '',
      subtitle: data.identity?.subtitle ?? '',
      summary: data.identity?.summary ?? '',
      email: data.identity?.email ?? '',
      phone: data.identity?.phone ?? '',
      location: data.identity?.location ?? '',
      linkedin: data.identity?.linkedin ?? '',
    },
    skills:
      data.skills?.map((s) => ({
        name: s.name ?? '',
        level: typeof s.level === 'number' ? s.level : null,
      })) ?? [],
    tools: data.tools ? [...data.tools] : [],
    languages:
      data.languages?.map((l) => ({
        name: l.name ?? '',
        levelLabel: l.levelLabel ?? '',
        dots: typeof l.dots === 'number' ? l.dots : null,
      })) ?? [],
    certifications:
      data.certifications?.map((c) => ({
        name: c.name ?? '',
        year: c.year ?? '',
      })) ?? [],
    education:
      data.education?.map((e) => ({
        degree: e.degree ?? '',
        school: e.school ?? '',
        year: e.year ?? '',
      })) ?? [],
    experiences:
      data.experiences?.map((e) => ({
        role: e.role ?? '',
        company: e.company ?? '',
        clientMeta: e.clientMeta ?? '',
        dateStart: e.dateStart ?? '',
        dateEnd: e.dateEnd ?? '',
        duration: e.duration ?? '',
        location: e.location ?? '',
        context: {
          team: e.context?.team ?? '',
          methodology: e.context?.methodology ?? '',
          role: e.context?.role ?? '',
          extraLabel: e.context?.extraLabel ?? '',
          extraValue: e.context?.extraValue ?? '',
        },
        mission: e.mission ?? '',
        activities:
          e.activities?.map((a) => ({
            bold: a.bold ?? '',
            text: a.text ?? '',
          })) ?? [],
        results:
          e.results?.map((r) => ({
            value: r.value ?? '',
            label: r.label ?? '',
          })) ?? [],
        tech:
          e.tech?.map((t) => ({
            category: t.category ?? '',
            items: t.items ?? '',
          })) ?? [],
      })) ?? [],
  };
}

function hasAnyIdentity(id: IdentityState): boolean {
  return Object.values(id).some((v) => v.trim().length > 0);
}

function compactIdentity(id: IdentityState): NonNullable<CvData['identity']> {
  const out: NonNullable<CvData['identity']> = {};
  if (id.firstName.trim()) out.firstName = id.firstName.trim();
  if (id.lastName.trim()) out.lastName = id.lastName.trim();
  if (id.initials.trim()) out.initials = id.initials.trim();
  if (id.role.trim()) out.role = id.role.trim();
  if (id.subtitle.trim()) out.subtitle = id.subtitle.trim();
  if (id.summary.trim()) out.summary = id.summary.trim();
  if (id.email.trim()) out.email = id.email.trim();
  if (id.phone.trim()) out.phone = id.phone.trim();
  if (id.location.trim()) out.location = id.location.trim();
  if (id.linkedin.trim()) out.linkedin = id.linkedin.trim();
  return out;
}

function hasAnyContext(ctx: ContextEntry): boolean {
  return Object.values(ctx).some((v) => v.trim().length > 0);
}

function compactContext(
  ctx: ContextEntry,
): NonNullable<NonNullable<CvData['experiences']>[number]['context']> {
  const out: NonNullable<
    NonNullable<CvData['experiences']>[number]['context']
  > = {};
  if (ctx.team.trim()) out.team = ctx.team.trim();
  if (ctx.methodology.trim()) out.methodology = ctx.methodology.trim();
  if (ctx.role.trim()) out.role = ctx.role.trim();
  if (ctx.extraLabel.trim()) out.extraLabel = ctx.extraLabel.trim();
  if (ctx.extraValue.trim()) out.extraValue = ctx.extraValue.trim();
  return out;
}

function compactExperience(
  e: ExperienceEntry,
): NonNullable<CvData['experiences']>[number] {
  const out: NonNullable<CvData['experiences']>[number] = {};
  if (e.role.trim()) out.role = e.role.trim();
  if (e.company.trim()) out.company = e.company.trim();
  if (e.clientMeta.trim()) out.clientMeta = e.clientMeta.trim();
  if (e.dateStart.trim()) out.dateStart = e.dateStart.trim();
  if (e.dateEnd.trim()) out.dateEnd = e.dateEnd.trim();
  if (e.duration.trim()) out.duration = e.duration.trim();
  if (e.location.trim()) out.location = e.location.trim();
  if (hasAnyContext(e.context)) out.context = compactContext(e.context);
  if (e.mission.trim()) out.mission = e.mission.trim();
  if (e.activities.length) {
    out.activities = e.activities.map((a) => ({
      ...(a.bold.trim() ? { bold: a.bold.trim() } : {}),
      ...(a.text.trim() ? { text: a.text.trim() } : {}),
    }));
  }
  if (e.results.length) {
    out.results = e.results.map((r) => ({
      ...(r.value.trim() ? { value: r.value.trim() } : {}),
      ...(r.label.trim() ? { label: r.label.trim() } : {}),
    }));
  }
  if (e.tech.length) {
    out.tech = e.tech.map((t) => ({
      ...(t.category.trim() ? { category: t.category.trim() } : {}),
      ...(t.items.trim() ? { items: t.items.trim() } : {}),
    }));
  }
  return out;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { error?: { message?: unknown }; message?: unknown };
    if (typeof e.error?.message === 'string') return e.error.message;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Une erreur inattendue est survenue.';
}
