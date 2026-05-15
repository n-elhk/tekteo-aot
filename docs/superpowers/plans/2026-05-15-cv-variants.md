# CV Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the consultant/CV model so a `Consultant` (person, with normalized identity + master CV) is distinct from `CvVariant` (an AI-adapted contextual variant of the master, tied to a `JobProfile` and a `template`). `GeneratedCv` (PDF artifact) becomes a child of `CvVariant`.

**Architecture:** Three Prisma models replace the current `ConsultantCv`/`GeneratedCv`. The AI-adaptation flow now produces `CvVariant` rows instead of cloning consultants. Front uses three NgRx Signal stores (consultants list, consultant detail, variant detail) wired through three routes.

**Tech Stack:** NestJS, Prisma, Anthropic SDK, BullMQ, Angular 21 (signals + signal forms), NgRx Signals, Angular CDK Dialog, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-15-cv-variants-design.md`

**Pre-requisite (manual, before Phase 1):** Reset the DB (dev only). Run `nx run api:prisma-migrate-reset` (or equivalent) **after** Phase 1's migration is generated, **before** running it.

---

## Phase 1 — Prisma schema + shared types

### Task 1.1: Add `Consultant` model in Prisma

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Append `Consultant` model and add inverse on `User`**

In `apps/api/prisma/schema.prisma`, locate the `User` model and add the inverse relation `consultants Consultant[] @relation("ConsultantCreator")` to its relations block (alongside the existing `cvs ConsultantCv[] @relation("CvCreator")` line — which we will remove in Task 1.3).

Then append the new model at the end of the file:

```prisma
model Consultant {
  id              String   @id @default(uuid())
  firstName       String   @map("first_name")
  lastName        String   @map("last_name")
  email           String   @unique
  phone           String?
  role            String?
  yearsExperience Int?     @map("years_experience")
  location        String?
  masterCvData    Json     @map("master_cv_data")
  createdById     String?  @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt      @map("updated_at")

  createdBy  User?         @relation("ConsultantCreator", fields: [createdById], references: [id], onDelete: SetNull)
  variants   CvVariant[]
  importJobs CvImportJob[]

  @@map("consultants")
}
```

- [ ] **Step 2: Verify the file still parses**

Run: `cd apps/api && npx prisma format`
Expected: file is reformatted with no error.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(prisma): add Consultant model"
```

---

### Task 1.2: Add `CvVariant` model and rewire `GeneratedCv`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Append `CvVariant` model**

Append at end of `apps/api/prisma/schema.prisma`:

```prisma
model CvVariant {
  id           String     @id @default(uuid())
  consultantId String     @map("consultant_id")
  jobProfileId String     @map("job_profile_id")
  template     CvTemplate
  name         String
  cvData       Json       @map("cv_data")
  createdById  String?    @map("created_by")
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt      @map("updated_at")

  consultant   Consultant    @relation(fields: [consultantId], references: [id], onDelete: Cascade)
  jobProfile   JobProfile    @relation(fields: [jobProfileId], references: [id], onDelete: Cascade)
  createdBy    User?         @relation("VariantCreator", fields: [createdById], references: [id], onDelete: SetNull)
  generatedCvs GeneratedCv[]

  @@index([consultantId])
  @@index([jobProfileId])
  @@map("cv_variants")
}
```

- [ ] **Step 2: Rewire `GeneratedCv` to `CvVariant`**

In the same file, locate the `GeneratedCv` model. Replace its body with:

```prisma
model GeneratedCv {
  id           String             @id @default(uuid())
  variantId    String             @map("variant_id")
  status       CvGenerationStatus @default(pending)
  outputPath   String?            @map("output_path")
  filename     String?
  errorMessage String?            @map("error_message")
  createdById  String?            @map("created_by")
  createdAt    DateTime           @default(now()) @map("created_at")
  updatedAt    DateTime           @updatedAt      @map("updated_at")

  variant   CvVariant     @relation(fields: [variantId], references: [id], onDelete: Cascade)
  createdBy User?         @relation("GeneratedCvCreator", fields: [createdById], references: [id], onDelete: SetNull)
  jobs      CvImportJob[]

  @@index([variantId])
  @@index([status])
  @@map("generated_cvs")
}
```

- [ ] **Step 3: Add inverse on `User`**

In the `User` model, add `variants CvVariant[] @relation("VariantCreator")` next to the existing `generatedCvs GeneratedCv[] @relation("GeneratedCvCreator")` relation.

- [ ] **Step 4: Verify**

Run: `cd apps/api && npx prisma format`
Expected: no error.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(prisma): add CvVariant model + rewire GeneratedCv"
```

---

### Task 1.3: Remove `ConsultantCv` model and its references

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Remove the `ConsultantCv` model block**

Delete the entire `model ConsultantCv { ... @@map("consultant_cvs") }` block.

- [ ] **Step 2: Remove `cvs ConsultantCv[] @relation("CvCreator")` from `User`**

In the `User` model, delete this relation line.

- [ ] **Step 3: Remove `cvId` and `cv` from `JobProfile`**

In the `JobProfile` model, delete the `cvId String?` and `cv ConsultantCv?` fields. Add the inverse for variants:

```prisma
variants CvVariant[]
```

- [ ] **Step 4: Remove denormalized consultant fields from `JobProfile`**

Delete these fields from `JobProfile`:
- `consultantName String? @map("consultant_name")`
- `consultantTitle String? @map("consultant_title")`
- `consultantYearsExp Int? @map("consultant_years_exp")`
- `consultantSummary String? @map("consultant_summary")`

- [ ] **Step 5: Verify**

Run: `cd apps/api && npx prisma format`
Expected: no error.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(prisma): drop ConsultantCv and denormalized job fields"
```

---

### Task 1.4: Rewire `CvImportJob` from `consultantCvId` to `consultantId`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Inspect current `CvImportJob`**

Open the file and locate the `CvImportJob` model. Note all FK fields pointing to `ConsultantCv`.

- [ ] **Step 2: Update fields**

Rename `consultantId` to keep the same name but make the FK target `consultants`. If there's a relation like `consultant ConsultantCv? @relation(...)`, change it to:

```prisma
consultant Consultant? @relation(fields: [consultantId], references: [id], onDelete: SetNull)
```

If `generatedCvId` exists, keep it pointing at `GeneratedCv` (now rewired to variants — semantics survive).

- [ ] **Step 3: Verify**

Run: `cd apps/api && npx prisma format`
Expected: no error.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(prisma): rewire CvImportJob to consultants table"
```

---

### Task 1.5: Reset DB and generate the migration

**Files:** none (DB ops)

- [ ] **Step 1: Reset the dev DB**

Run: `cd apps/api && npx prisma migrate reset --force --skip-seed`
Expected: DB dropped + recreated, all prior migrations applied. Existing `consultant_cvs` data is lost (acted: app is in dev, no production data).

- [ ] **Step 2: Generate the new migration**

Run: `cd apps/api && npx prisma migrate dev --name "consultants_and_cv_variants"`
Expected: a new SQL file under `apps/api/prisma/migrations/<ts>_consultants_and_cv_variants/migration.sql`, applied to the DB.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `cd apps/api && npx prisma generate`
Expected: client regenerated under `apps/api/src/generated/prisma`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/migrations/
git commit -m "chore(prisma): apply consultants_and_cv_variants migration"
```

---

### Task 1.6: Update `@org/schemas` — add Consultant DTOs

**Files:**
- Modify: `libs/shared/schemas/src/lib/schemas.ts`

- [ ] **Step 1: Add Consultant schemas just before the `// ConsultantCv schemas` section**

Insert this block just before line 316 (the `// ConsultantCv schemas` divider):

```ts
// ============================================================
// Consultant schemas
// ============================================================

export const createConsultantSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  role: z.string().max(200).optional(),
  yearsExperience: z.number().int().min(0).max(80).optional(),
  location: z.string().max(200).optional(),
  masterCvData: cvDataSchema,
});
export type CreateConsultantDto = z.infer<typeof createConsultantSchema>;

export const updateConsultantSchema = createConsultantSchema.partial();
export type UpdateConsultantDto = z.infer<typeof updateConsultantSchema>;

export const importConsultantFromTextSchema = z.object({
  cvText: z.string().min(50).max(50000),
  model: z.string().min(2).max(80).optional(),
  persist: z.boolean().default(true),
});
export type ImportConsultantFromTextDto = z.infer<typeof importConsultantFromTextSchema>;

export const consultantsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ConsultantsListQueryDto = z.infer<typeof consultantsListQuerySchema>;
```

Note: `cvDataSchema` is declared a few lines later in the file. Move the `cvDataSchema` block + its subschemas (`cvIdentitySchema`, `cvSkillSchema`, …) **above** the new Consultant block so it's defined before use. Alternatively keep the original location and place the Consultant block **after** `cvDataSchema` (line ~388). Pick one and ensure declaration order.

- [ ] **Step 2: Verify the schemas lib builds**

Run: `nx run schemas:build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add libs/shared/schemas/src/lib/schemas.ts
git commit -m "feat(schemas): add Consultant DTOs"
```

---

### Task 1.7: Update `@org/schemas` — add CvVariant DTOs

**Files:**
- Modify: `libs/shared/schemas/src/lib/schemas.ts`

- [ ] **Step 1: Add CvVariant schemas right after the Consultant block**

```ts
// ============================================================
// CvVariant schemas
// ============================================================

export const createCvVariantSchema = z.object({
  jobProfileId: z.uuid(),
  template: cvTemplateSchema, // existing enum: 'tekteo' | 'anonyme'
  name: z.string().min(1).max(300).optional(),
});
export type CreateCvVariantDto = z.infer<typeof createCvVariantSchema>;

export const updateCvVariantSchema = z.object({
  cvData: cvDataSchema.optional(),
  name: z.string().min(1).max(300).optional(),
});
export type UpdateCvVariantDto = z.infer<typeof updateCvVariantSchema>;

export const regenerateCvVariantSchema = z.object({
  model: z.string().min(2).max(80).optional(),
});
export type RegenerateCvVariantDto = z.infer<typeof regenerateCvVariantSchema>;
```

Ensure `cvTemplateSchema` is declared before this block (it already exists in the file).

- [ ] **Step 2: Verify**

Run: `nx run schemas:build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add libs/shared/schemas/src/lib/schemas.ts
git commit -m "feat(schemas): add CvVariant DTOs"
```

---

### Task 1.8: Remove obsolete `ConsultantCv` DTOs from `@org/schemas`

**Files:**
- Modify: `libs/shared/schemas/src/lib/schemas.ts`

- [ ] **Step 1: Delete obsolete schemas and types**

Remove these exports (do **not** remove `cvDataSchema`, `cvIdentitySchema`, etc. — those stay):
- `createConsultantCvSchema` + `CreateConsultantCvDto`
- `updateConsultantCvSchema` + `UpdateConsultantCvDto`
- `formatCvFromTextSchema` + `FormatCvFromTextDto` (replaced by `importConsultantFromTextSchema`)
- `adaptCvToJobSchema` + `AdaptCvToJobDto`
- `consultantCvsListQuerySchema` + `ConsultantCvsListQueryDto`

- [ ] **Step 2: Verify the schemas lib still builds**

Run: `nx run schemas:build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add libs/shared/schemas/src/lib/schemas.ts
git commit -m "feat(schemas): remove obsolete ConsultantCv DTOs"
```

---

## Phase 2 — Backend implementation

After this phase the API compiles and runs. The front will still be broken — fixed in Phases 3-4.

### Task 2.1: Rename `consultant-cvs` module folder to `consultants`

**Files:**
- Move: `apps/api/src/modules/consultant-cvs/` → `apps/api/src/modules/consultants/`

- [ ] **Step 1: Rename the folder**

Run: `git mv apps/api/src/modules/consultant-cvs apps/api/src/modules/consultants`
Expected: folder + files renamed in git.

- [ ] **Step 2: Inspect what's inside**

Run: `ls apps/api/src/modules/consultants/`
Expected:
```
consultant-cvs.controller.ts
consultant-cvs.module.ts
consultant-cvs.service.ts
cv-import-event.service.ts
cv-import.processor.ts
cv-import.service.ts
cv-prompts.ts
cv-template-prompts.ts
generated-cvs.service.ts
pdf-renderer.service.ts
template-filler.service.ts
```

- [ ] **Step 3: Commit (intermediate, no code change)**

```bash
git add apps/api/src/modules/
git commit -m "refactor(api): rename consultant-cvs folder to consultants"
```

---

### Task 2.2: Replace `ConsultantCvsService` with `ConsultantsService` (CRUD only)

**Files:**
- Rename: `apps/api/src/modules/consultants/consultant-cvs.service.ts` → `apps/api/src/modules/consultants/consultants.service.ts`
- Test: `apps/api/src/modules/consultants/consultants.service.spec.ts` (new)

- [ ] **Step 1: Write a failing CRUD test for `create`**

Create `apps/api/src/modules/consultants/consultants.service.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConsultantsService } from './consultants.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { GenerationHistoryService } from '../generation-history/generation-history.service';

describe('ConsultantsService.create', () => {
  let service: ConsultantsService;
  let prisma: { consultant: { create: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    prisma = { consultant: { create: vi.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConsultantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AnthropicService, useValue: {} },
        { provide: GenerationHistoryService, useValue: { record: vi.fn() } },
      ],
    }).compile();
    service = moduleRef.get(ConsultantsService);
  });

  it('persists firstName, lastName, email and masterCvData', async () => {
    prisma.consultant.create.mockResolvedValue({ id: 'c1' });
    await service.create('user1', {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean@example.com',
      masterCvData: { identity: { firstName: 'Jean' } } as any,
    });
    expect(prisma.consultant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean@example.com',
        createdById: 'user1',
      }),
    });
  });
});
```

Note: `vi` must be imported from `vitest`. Add `import { vi } from 'vitest'` at top.

- [ ] **Step 2: Run test, expect failure**

Run: `nx run api:test -- --run consultants.service.spec`
Expected: FAIL (no `ConsultantsService` yet, or method missing).

- [ ] **Step 3: Implement `ConsultantsService` with the minimum CRUD**

Rename `consultant-cvs.service.ts` to `consultants.service.ts` and replace its content with:

```ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type {
  CreateConsultantDto,
  UpdateConsultantDto,
  ImportConsultantFromTextDto,
  CvData,
} from '@org/schemas';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseLlmJson } from '../../common/utils/llm-json.util';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import { FORMAT_SYSTEM_PROMPT, buildFormatPrompt } from './cv-prompts';

@Injectable()
export class ConsultantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly history: GenerationHistoryService,
  ) {}

  async findAll(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.consultant.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          createdBy: { select: { id: true, email: true, fullName: true } },
          _count: { select: { variants: true } },
        },
      }),
      this.prisma.consultant.count(),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const consultant = await this.prisma.consultant.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        variants: {
          orderBy: { createdAt: 'desc' },
          include: {
            jobProfile: { select: { id: true, title: true, projectId: true } },
            generatedCvs: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { id: true, status: true, updatedAt: true, filename: true },
            },
          },
        },
      },
    });
    if (!consultant) throw new NotFoundException(`Consultant ${id} introuvable`);
    return consultant;
  }

  create(userId: string, dto: CreateConsultantDto) {
    return this.prisma.consultant
      .create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone ?? null,
          role: dto.role ?? null,
          yearsExperience: dto.yearsExperience ?? null,
          location: dto.location ?? null,
          masterCvData: dto.masterCvData as Prisma.InputJsonValue,
          createdById: userId,
        },
      })
      .catch(this.handleUniqueEmail);
  }

  async update(id: string, dto: UpdateConsultantDto) {
    await this.findOne(id);
    return this.prisma.consultant
      .update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.yearsExperience !== undefined && { yearsExperience: dto.yearsExperience }),
          ...(dto.location !== undefined && { location: dto.location }),
          ...(dto.masterCvData !== undefined && {
            masterCvData: dto.masterCvData as Prisma.InputJsonValue,
          }),
        },
      })
      .catch(this.handleUniqueEmail);
  }

  async remove(id: string) {
    await this.findOne(id);
    // CASCADE Prisma supprime variants + generatedCvs. La purge storage
    // est effectuée en amont par CvVariantsService.removeForConsultant.
    return this.prisma.consultant.delete({ where: { id } });
  }

  // ---------------- Import depuis texte ----------------

  async importFromText(userId: string, dto: ImportConsultantFromTextDto) {
    const generation = await this.anthropic.generate({
      systemPrompt: FORMAT_SYSTEM_PROMPT,
      userMessage: buildFormatPrompt(dto.cvText),
      maxTokens: 8192,
    });

    const cvData = parseLlmJson<CvData>(generation.content);
    const tokensUsed = generation.usage.inputTokens + generation.usage.outputTokens;

    await this.history.record({
      module: 'cv',
      userId,
      modelUsed: generation.modelUsed,
      tokensUsed,
      outputContent: JSON.stringify(cvData).slice(0, 4000),
      inputData: { mode: 'import-text', textLength: dto.cvText.length },
    });

    if (!dto.persist) {
      return {
        consultant: null,
        cvData,
        usage: { tokensUsed, modelUsed: generation.modelUsed },
      };
    }

    const identity = (cvData.identity ?? {}) as Record<string, unknown>;
    const firstName = stringOr(identity.firstName, 'Inconnu');
    const lastName = stringOr(identity.lastName, 'Inconnu');
    const email = stringOr(identity.email, null);
    if (!email) {
      throw new ConflictException(
        "Aucune adresse email n'a pu être extraite du CV — création impossible.",
      );
    }

    const consultant = await this.prisma.consultant
      .create({
        data: {
          firstName,
          lastName,
          email,
          phone: stringOr(identity.phone, null),
          role: stringOr(identity.role, null),
          location: stringOr(identity.location, null),
          masterCvData: cvData as unknown as Prisma.InputJsonValue,
          createdById: userId,
        },
      })
      .catch(this.handleUniqueEmail);

    return {
      consultant,
      usage: { tokensUsed, modelUsed: generation.modelUsed },
    };
  }

  private handleUniqueEmail = (err: unknown): never => {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      Array.isArray(err.meta?.target) &&
      (err.meta?.target as string[]).includes('email')
    ) {
      throw new ConflictException('Un consultant avec cet email existe déjà');
    }
    throw err;
  };
}

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}
```

- [ ] **Step 4: Re-run the test**

Run: `nx run api:test -- --run consultants.service.spec`
Expected: PASS.

- [ ] **Step 5: Add a test for `importFromText` (success path)**

Append to `consultants.service.spec.ts`:

```ts
describe('ConsultantsService.importFromText', () => {
  it('extracts identity from cvData and creates a Consultant', async () => {
    const prisma = { consultant: { create: vi.fn().mockResolvedValue({ id: 'c2' }) } };
    const anthropic = {
      generate: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          identity: { firstName: 'Marie', lastName: 'Durand', email: 'marie@x.fr', role: 'Dev' },
        }),
        usage: { inputTokens: 100, outputTokens: 200 },
        modelUsed: 'claude-x',
      }),
    };
    const history = { record: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConsultantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AnthropicService, useValue: anthropic },
        { provide: GenerationHistoryService, useValue: history },
      ],
    }).compile();
    const svc = moduleRef.get(ConsultantsService);

    const result = await svc.importFromText('user1', {
      cvText: 'a'.repeat(60),
      persist: true,
    });

    expect(prisma.consultant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Marie',
        lastName: 'Durand',
        email: 'marie@x.fr',
        role: 'Dev',
        createdById: 'user1',
      }),
    });
    expect(result.consultant).toEqual({ id: 'c2' });
  });
});
```

- [ ] **Step 6: Run all tests**

Run: `nx run api:test -- --run consultants.service.spec`
Expected: PASS (2 describe blocks).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/consultants/consultants.service.ts apps/api/src/modules/consultants/consultants.service.spec.ts
git rm apps/api/src/modules/consultants/consultant-cvs.service.ts || true
git commit -m "feat(api): introduce ConsultantsService with CRUD + import"
```

---

### Task 2.3: Create `CvVariantsService` with create flow + test

**Files:**
- Create: `apps/api/src/modules/cv-variants/cv-variants.service.ts`
- Create: `apps/api/src/modules/cv-variants/cv-variants.service.spec.ts`

- [ ] **Step 1: Create the directory**

Run: `mkdir -p apps/api/src/modules/cv-variants`

- [ ] **Step 2: Write the failing test for `create`**

Create `apps/api/src/modules/cv-variants/cv-variants.service.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { CvVariantsService } from './cv-variants.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { GenerationHistoryService } from '../generation-history/generation-history.service';

describe('CvVariantsService.create', () => {
  it('calls Anthropic with master cvData + jobProfile and inserts a variant', async () => {
    const consultant = {
      id: 'c1',
      masterCvData: { identity: { firstName: 'Marie' } },
    };
    const jobProfile = {
      id: 'jp1',
      title: 'Dev Backend',
      experienceLevel: 'senior',
      requiredSkills: ['Node'],
      optionalSkills: [],
      missions: 'Construire X',
      education: 'Bac+5',
      projectId: 'p1',
    };
    const prisma = {
      consultant: { findUnique: vi.fn().mockResolvedValue(consultant) },
      jobProfile: { findUnique: vi.fn().mockResolvedValue(jobProfile) },
      cvVariant: { create: vi.fn().mockResolvedValue({ id: 'v1' }) },
    };
    const anthropic = {
      generate: vi.fn().mockResolvedValue({
        content: JSON.stringify({ identity: { firstName: 'Marie' }, skills: [{ name: 'Node' }] }),
        usage: { inputTokens: 100, outputTokens: 200 },
        modelUsed: 'claude-x',
      }),
    };
    const history = { record: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CvVariantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AnthropicService, useValue: anthropic },
        { provide: GenerationHistoryService, useValue: history },
      ],
    }).compile();
    const svc = moduleRef.get(CvVariantsService);

    const result = await svc.create('c1', 'user1', {
      jobProfileId: 'jp1',
      template: 'tekteo',
    });

    expect(prisma.cvVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        consultantId: 'c1',
        jobProfileId: 'jp1',
        template: 'tekteo',
        createdById: 'user1',
        name: expect.stringContaining('Dev Backend'),
      }),
    });
    expect(history.record).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'cv',
        inputData: expect.objectContaining({ mode: 'create-variant' }),
      }),
    );
    expect(result.variant).toEqual({ id: 'v1' });
  });
});
```

- [ ] **Step 3: Run the test, expect failure**

Run: `nx run api:test -- --run cv-variants.service.spec`
Expected: FAIL.

- [ ] **Step 4: Implement `CvVariantsService.create`**

Create `apps/api/src/modules/cv-variants/cv-variants.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type {
  CreateCvVariantDto,
  CvData,
  CvTemplateValue,
  UpdateCvVariantDto,
} from '@org/schemas';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseLlmJson } from '../../common/utils/llm-json.util';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import {
  ADAPT_SYSTEM_PROMPT,
  buildAdaptPrompt,
  type JobProfilePayload,
} from '../consultants/cv-prompts';

@Injectable()
export class CvVariantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly history: GenerationHistoryService,
  ) {}

  async findOne(id: string) {
    const variant = await this.prisma.cvVariant.findUnique({
      where: { id },
      include: {
        consultant: true,
        jobProfile: { select: { id: true, title: true, projectId: true } },
        generatedCvs: {
          orderBy: { updatedAt: 'desc' },
          select: { id: true, status: true, filename: true, updatedAt: true },
        },
      },
    });
    if (!variant) throw new NotFoundException(`Variante ${id} introuvable`);
    return variant;
  }

  async create(consultantId: string, userId: string, dto: CreateCvVariantDto) {
    const consultant = await this.prisma.consultant.findUnique({
      where: { id: consultantId },
    });
    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} introuvable`);
    }
    const jobProfile = await this.prisma.jobProfile.findUnique({
      where: { id: dto.jobProfileId },
    });
    if (!jobProfile) {
      throw new NotFoundException(`Fiche de poste ${dto.jobProfileId} introuvable`);
    }

    const payload: JobProfilePayload = {
      title: jobProfile.title,
      experienceLevel: jobProfile.experienceLevel,
      requiredSkills: jobProfile.requiredSkills,
      optionalSkills: jobProfile.optionalSkills,
      missions: jobProfile.missions,
      education: jobProfile.education,
    };

    const generation = await this.anthropic.generate({
      systemPrompt: ADAPT_SYSTEM_PROMPT,
      userMessage: buildAdaptPrompt(
        consultant.masterCvData as unknown as CvData,
        payload,
      ),
      maxTokens: 16_000,
    });
    const cvData = parseLlmJson<CvData>(generation.content);
    const tokensUsed = generation.usage.inputTokens + generation.usage.outputTokens;

    const name = dto.name ?? buildAutoName(jobProfile.title, dto.template);

    const variant = await this.prisma.cvVariant.create({
      data: {
        consultantId,
        jobProfileId: jobProfile.id,
        template: dto.template,
        name,
        cvData: cvData as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    await this.history.record({
      module: 'cv',
      projectId: jobProfile.projectId ?? undefined,
      userId,
      modelUsed: generation.modelUsed,
      tokensUsed,
      outputContent: `Variante créée depuis consultant ${consultantId} vers fiche ${jobProfile.title}`,
      inputData: {
        mode: 'create-variant',
        consultantId,
        jobProfileId: jobProfile.id,
        template: dto.template,
        variantId: variant.id,
      },
    });

    return { variant, usage: { tokensUsed, modelUsed: generation.modelUsed } };
  }

  async update(id: string, dto: UpdateCvVariantDto) {
    await this.findOne(id);
    return this.prisma.cvVariant.update({
      where: { id },
      data: {
        ...(dto.cvData !== undefined && {
          cvData: dto.cvData as Prisma.InputJsonValue,
        }),
        ...(dto.name !== undefined && { name: dto.name }),
      },
    });
  }

  async regenerate(id: string, userId: string) {
    const variant = await this.findOne(id);
    // findOne renvoie un jobProfile partiel — on relit le job complet pour le prompt
    const fullJob = await this.prisma.jobProfile.findUniqueOrThrow({
      where: { id: variant.jobProfileId },
    });

    const payload: JobProfilePayload = {
      title: fullJob.title,
      experienceLevel: fullJob.experienceLevel,
      requiredSkills: fullJob.requiredSkills,
      optionalSkills: fullJob.optionalSkills,
      missions: fullJob.missions,
      education: fullJob.education,
    };

    const generation = await this.anthropic.generate({
      systemPrompt: ADAPT_SYSTEM_PROMPT,
      userMessage: buildAdaptPrompt(
        variant.consultant.masterCvData as unknown as CvData,
        payload,
      ),
      maxTokens: 16_000,
    });
    const cvData = parseLlmJson<CvData>(generation.content);
    const tokensUsed = generation.usage.inputTokens + generation.usage.outputTokens;

    const updated = await this.prisma.cvVariant.update({
      where: { id },
      data: { cvData: cvData as unknown as Prisma.InputJsonValue },
    });

    await this.history.record({
      module: 'cv',
      projectId: fullJob.projectId ?? undefined,
      userId,
      modelUsed: generation.modelUsed,
      tokensUsed,
      outputContent: `Variante ${id} régénérée`,
      inputData: { mode: 'regenerate-variant', variantId: id },
    });

    return { variant: updated, usage: { tokensUsed, modelUsed: generation.modelUsed } };
  }

  remove(id: string) {
    // La purge des fichiers PDF est faite par GeneratedCvsService avant cascade.
    return this.prisma.cvVariant.delete({ where: { id } });
  }

  listForConsultant(consultantId: string) {
    return this.prisma.cvVariant.findMany({
      where: { consultantId },
      orderBy: { createdAt: 'desc' },
      include: {
        jobProfile: { select: { id: true, title: true, projectId: true } },
        generatedCvs: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { id: true, status: true, filename: true, updatedAt: true },
        },
      },
    });
  }
}

function buildAutoName(jobTitle: string, template: CvTemplateValue): string {
  const label = template === 'tekteo' ? 'Tekteo' : 'Anonyme';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${jobTitle} — ${label} — ${stamp}`;
}
```

- [ ] **Step 5: Re-run the test**

Run: `nx run api:test -- --run cv-variants.service.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/cv-variants/
git commit -m "feat(api): add CvVariantsService (create + update + regenerate)"
```

---

### Task 2.4: Rework `GeneratedCvsService` for variants

**Files:**
- Modify: `apps/api/src/modules/consultants/generated-cvs.service.ts`

- [ ] **Step 1: Move file to cv-variants module**

Run: `git mv apps/api/src/modules/consultants/generated-cvs.service.ts apps/api/src/modules/cv-variants/generated-cvs.service.ts`

- [ ] **Step 2: Rewrite the service to operate on variants**

Replace its content with:

```ts
import { join } from 'node:path';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { CvTemplateValue } from '@org/schemas';
import {
  AbstractStorageService,
  type StoredFile,
} from '../../common/storage/storage.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const STORAGE_SCOPE_ROOT = 'cv-outputs';

@Injectable()
export class GeneratedCvsService {
  private readonly logger = new Logger(GeneratedCvsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: AbstractStorageService,
  ) {}

  createPending(variantId: string, userId: string) {
    return this.prisma.generatedCv.create({
      data: {
        variantId,
        status: 'pending',
        createdById: userId,
      },
    });
  }

  markProcessing(id: string) {
    return this.prisma.generatedCv.update({
      where: { id },
      data: { status: 'processing' },
    });
  }

  markSuccess(id: string, storedFile: StoredFile, filename: string) {
    return this.prisma.generatedCv.update({
      where: { id },
      data: {
        status: 'success',
        outputPath: storedFile.storagePath,
        filename,
      },
    });
  }

  markFailed(id: string, errorMessage: string) {
    return this.prisma.generatedCv.update({
      where: { id },
      data: {
        status: 'failed',
        errorMessage: errorMessage.slice(0, 2000),
      },
    });
  }

  storePdf(
    generatedCvId: string,
    variantId: string,
    buffer: Buffer,
    filename: string,
  ): Promise<StoredFile> {
    return this.storage.save(
      join(STORAGE_SCOPE_ROOT, variantId),
      `${generatedCvId}.pdf`,
      buffer,
    );
  }

  async findOne(id: string, variantId: string) {
    const cv = await this.prisma.generatedCv.findFirst({
      where: { id, variantId },
    });
    if (!cv) throw new NotFoundException(`CV généré ${id} introuvable`);
    return cv;
  }

  async getDownload(id: string, variantId: string) {
    const cv = await this.findOne(id, variantId);
    if (cv.status !== 'success' || !cv.outputPath) {
      throw new ConflictException("Le CV n'est pas encore généré ou a échoué");
    }
    return {
      stream: this.storage.createReadStream(cv.outputPath),
      filename: cv.filename ?? `cv_${id}.pdf`,
    };
  }

  async remove(id: string, variantId: string) {
    const cv = await this.findOne(id, variantId);
    if (cv.outputPath) {
      try {
        await this.storage.remove(cv.outputPath);
      } catch (err) {
        this.logger.warn(`Suppression fichier ${cv.outputPath} échouée : ${err}`);
      }
    }
    await this.prisma.generatedCv.delete({ where: { id } });
  }

  async purgeForVariant(variantId: string) {
    const cvs = await this.prisma.generatedCv.findMany({
      where: { variantId, outputPath: { not: null } },
      select: { id: true, outputPath: true },
    });
    for (const cv of cvs) {
      if (!cv.outputPath) continue;
      try {
        await this.storage.remove(cv.outputPath);
      } catch (err) {
        this.logger.warn(`Purge fichier ${cv.outputPath} échouée : ${err}`);
      }
    }
  }

  async purgeForConsultant(consultantId: string) {
    const cvs = await this.prisma.generatedCv.findMany({
      where: { variant: { consultantId }, outputPath: { not: null } },
      select: { id: true, outputPath: true },
    });
    for (const cv of cvs) {
      if (!cv.outputPath) continue;
      try {
        await this.storage.remove(cv.outputPath);
      } catch (err) {
        this.logger.warn(`Purge fichier ${cv.outputPath} échouée : ${err}`);
      }
    }
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `nx run api:build`
Expected: only `cv-import.processor.ts` and the controllers should error (next tasks). The service file itself compiles.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/cv-variants/generated-cvs.service.ts
git commit -m "feat(api): rewire GeneratedCvsService on variants"
```

---

### Task 2.5: Update `cv-import.processor.ts` for new model

**Files:**
- Modify: `apps/api/src/modules/consultants/cv-import.processor.ts`

- [ ] **Step 1: Rewrite the import pipeline to create a `Consultant`**

Replace the `runImportPipeline` method body. The two helpers `extractIdentityName` / `extractIdentityRole` at the bottom of the file are no longer used — delete them.

Locate `runImportPipeline` and replace its body. The relevant section (after extracting `cvData` from the IA result, around lines 90-138) becomes:

```ts
private async runImportPipeline(importJob: {
  id: string;
  userId: string;
  inputPath: string | null;
  inputFilename: string | null;
  template: CvTemplateValue;
}): Promise<void> {
  if (!importJob.inputPath) {
    throw new Error('extraction_failed: inputPath manquant pour un job import');
  }

  const generation = await this.extract(importJob.inputPath);
  const cvData = parseLlmJson<CvData>(generation.content);
  const tokensUsed =
    generation.usage.inputTokens + generation.usage.outputTokens;

  const identity = (cvData.identity ?? {}) as Record<string, unknown>;
  const firstName = stringOr(identity.firstName, 'Inconnu');
  const lastName = stringOr(identity.lastName, 'Inconnu');
  const email = stringOr(identity.email, null);
  if (!email) {
    throw new Error(
      'extraction_failed: aucun email extrait du CV — création impossible',
    );
  }

  const consultant = await this.prisma.consultant.create({
    data: {
      firstName,
      lastName,
      email,
      phone: stringOr(identity.phone, null),
      role: stringOr(identity.role, null),
      location: stringOr(identity.location, null),
      masterCvData: cvData as unknown as Prisma.InputJsonValue,
      createdById: importJob.userId,
    },
  });

  await this.prisma.cvImportJob.update({
    where: { id: importJob.id },
    data: { consultantId: consultant.id },
  });
  this.events.emit(importJob.id, {
    status: 'processing',
    consultantId: consultant.id,
  });

  await this.history.record({
    module: 'cv',
    userId: importJob.userId,
    modelUsed: generation.modelUsed,
    tokensUsed,
    outputContent: `Import depuis ${importJob.inputFilename ?? '(inconnu)'} → consultant ${consultant.id}`,
    inputData: {
      mode: 'import-file',
      template: importJob.template,
      inputFilename: importJob.inputFilename,
    },
  });

  // NOTE: l'ancien pipeline générait automatiquement un PDF "tekteo" après import.
  // Ce n'est plus possible : un PDF est rendu pour une VARIANTE, pas un consultant
  // brut. L'utilisateur devra créer une variante depuis l'UI puis lancer le rendu.
  // → on marque le job comme done.
  await this.markStatus(importJob.id, 'done');
  this.events.emit(importJob.id, {
    status: 'done',
    consultantId: consultant.id,
  });
}
```

- [ ] **Step 2: Delete `runGeneratePipeline` and `runGenerationSteps` from this processor**

The generate flow (rendering PDF from an existing consultant) moves out of this processor — a variant-level service will handle it. Remove both methods. Also remove the `runGenerateCv` call site in `process()` — replace it with:

```ts
async process(job: Job<CvImportJobPayload>): Promise<void> {
  const { jobId, kind } = job.data;
  this.logger.log(`Processing CV ${kind} ${jobId}`);

  const importJob = await this.prisma.cvImportJob.findUnique({ where: { id: jobId } });
  if (!importJob) {
    this.logger.warn(`CvImportJob ${jobId} introuvable, on ignore`);
    return;
  }

  if (kind !== 'import') {
    throw new Error(
      `Unsupported job kind '${kind}' — generate flow moved to CvVariantPdfService`,
    );
  }

  await this.markStatus(jobId, 'processing');
  try {
    await this.runImportPipeline(importJob);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`Job ${jobId} failed: ${message}`);
    await this.prisma.cvImportJob.update({
      where: { id: jobId },
      data: { status: 'failed', errorMessage: message.slice(0, 2000) },
    });
    this.events.emit(jobId, { status: 'failed', error: message.slice(0, 2000) });
    throw err;
  }
}
```

- [ ] **Step 3: Add the `stringOr` helper at the bottom and drop old ones**

Replace the bottom helpers with:

```ts
function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}
```

Delete `extractIdentityName`, `extractIdentityRole`, `buildFilename` (the latter is no longer used here either).

- [ ] **Step 4: Update unused imports**

Remove imports of `TemplateFillerService`, `PdfRendererService`, `GeneratedCvsService` from this file — they are no longer used. Also remove these constructor params.

- [ ] **Step 5: Verify build**

Run: `nx run api:build`
Expected: errors only in the controllers / module / cv-import.service (next tasks).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/consultants/cv-import.processor.ts
git commit -m "feat(api): import processor creates Consultant, no auto PDF"
```

---

### Task 2.6: Create `CvVariantPdfService` (the former generate pipeline)

**Files:**
- Create: `apps/api/src/modules/cv-variants/cv-variant-pdf.service.ts`

- [ ] **Step 1: Add the new service**

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { CvData, CvTemplateValue } from '@org/schemas';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import { TemplateFillerService } from '../consultants/template-filler.service';
import { PdfRendererService } from '../consultants/pdf-renderer.service';
import { GeneratedCvsService } from './generated-cvs.service';

@Injectable()
export class CvVariantPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateFiller: TemplateFillerService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly generatedCvs: GeneratedCvsService,
    private readonly history: GenerationHistoryService,
  ) {}

  async render(variantId: string, userId: string) {
    const variant = await this.prisma.cvVariant.findUniqueOrThrow({
      where: { id: variantId },
      include: { consultant: true },
    });

    const generated = await this.generatedCvs.createPending(variant.id, userId);
    await this.generatedCvs.markProcessing(generated.id);

    try {
      const filled = await this.templateFiller.fill(
        variant.cvData as unknown as CvData,
        variant.template,
      );
      const pdfBuffer = await this.pdfRenderer.render(filled.html);
      const filename = buildFilename(variant.consultant.lastName, variant.template);
      const stored = await this.generatedCvs.storePdf(
        generated.id,
        variant.id,
        pdfBuffer,
        filename,
      );
      await this.generatedCvs.markSuccess(generated.id, stored, filename);

      await this.history.record({
        module: 'cv',
        userId,
        modelUsed: filled.modelUsed,
        tokensUsed: filled.tokensUsed,
        outputContent: `PDF rendu pour variante ${variant.id}`,
        inputData: {
          mode: 'render-pdf',
          variantId: variant.id,
          template: variant.template,
        },
      });

      return await this.prisma.generatedCv.findUniqueOrThrow({
        where: { id: generated.id },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.generatedCvs.markFailed(generated.id, msg);
      throw err;
    }
  }
}

function buildFilename(lastName: string, template: CvTemplateValue): string {
  const slug = lastName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'consultant';
  return `${slug}_${template}.pdf`;
}
```

- [ ] **Step 2: Verify**

Run: `nx run api:build`
Expected: errors only in controllers/modules (next tasks).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/cv-variants/cv-variant-pdf.service.ts
git commit -m "feat(api): CvVariantPdfService — render PDF from a variant"
```

---

### Task 2.7: Create `CvVariantsController`

**Files:**
- Create: `apps/api/src/modules/cv-variants/cv-variants.controller.ts`

- [ ] **Step 1: Write the controller**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  createCvVariantSchema,
  regenerateCvVariantSchema,
  updateCvVariantSchema,
  type CreateCvVariantDto,
  type RegenerateCvVariantDto,
  type UpdateCvVariantDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { CvVariantsService } from './cv-variants.service';
import { CvVariantPdfService } from './cv-variant-pdf.service';
import { GeneratedCvsService } from './generated-cvs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CvVariantsController {
  constructor(
    private readonly variants: CvVariantsService,
    private readonly variantPdf: CvVariantPdfService,
    private readonly generated: GeneratedCvsService,
  ) {}

  @Get('consultants/:consultantId/variants')
  list(@Param('consultantId') consultantId: string) {
    return this.variants.listForConsultant(consultantId);
  }

  @Post('consultants/:consultantId/variants')
  @Roles(['admin', 'redacteur'])
  @HttpCode(201)
  create(
    @Param('consultantId') consultantId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCvVariantSchema)) dto: CreateCvVariantDto,
  ) {
    return this.variants.create(consultantId, user.id, dto);
  }

  @Get('variants/:id')
  findOne(@Param('id') id: string) {
    return this.variants.findOne(id);
  }

  @Patch('variants/:id')
  @Roles(['admin', 'redacteur'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCvVariantSchema)) dto: UpdateCvVariantDto,
  ) {
    return this.variants.update(id, dto);
  }

  @Delete('variants/:id')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.variants.remove(id);
  }

  @Post('variants/:id/regenerate')
  @Roles(['admin', 'redacteur'])
  @HttpCode(200)
  regenerate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(regenerateCvVariantSchema))
    _dto: RegenerateCvVariantDto,
  ) {
    return this.variants.regenerate(id, user.id);
  }

  @Post('variants/:id/generated-cvs')
  @Roles(['admin', 'redacteur'])
  @HttpCode(201)
  triggerPdf(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.variantPdf.render(id, user.id);
  }

  @Get('variants/:variantId/generated-cvs/:genId/download')
  async download(
    @Param('variantId') variantId: string,
    @Param('genId') genId: string,
    @Res() res: Response,
  ) {
    const { stream, filename } = await this.generated.getDownload(genId, variantId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }

  @Delete('variants/:variantId/generated-cvs/:genId')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async removeGenerated(
    @Param('variantId') variantId: string,
    @Param('genId') genId: string,
  ) {
    await this.generated.remove(genId, variantId);
  }
}
```

- [ ] **Step 2: Commit (build still failing — module not wired yet)**

```bash
git add apps/api/src/modules/cv-variants/cv-variants.controller.ts
git commit -m "feat(api): CvVariantsController endpoints"
```

---

### Task 2.8: Rewrite `ConsultantsController`

**Files:**
- Modify: `apps/api/src/modules/consultants/consultant-cvs.controller.ts` → rename

- [ ] **Step 1: Rename the file**

Run: `git mv apps/api/src/modules/consultants/consultant-cvs.controller.ts apps/api/src/modules/consultants/consultants.controller.ts`

- [ ] **Step 2: Replace its content**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { concat, map, Observable, of } from 'rxjs';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  consultantsListQuerySchema,
  createConsultantSchema,
  cvTemplateSchema,
  importConsultantFromTextSchema,
  updateConsultantSchema,
  type ConsultantsListQueryDto,
  type CreateConsultantDto,
  type CvTemplateValue,
  type ImportConsultantFromTextDto,
  type UpdateConsultantDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { ConsultantsService } from './consultants.service';
import { CvImportEventService } from './cv-import-event.service';
import { CvImportService } from './cv-import.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consultants')
export class ConsultantsController {
  constructor(
    private readonly consultants: ConsultantsService,
    private readonly imports: CvImportService,
    private readonly importEvents: CvImportEventService,
  ) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(consultantsListQuerySchema))
    query: ConsultantsListQueryDto,
  ) {
    return this.consultants.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.consultants.findOne(id);
  }

  @Post()
  @Roles(['admin', 'redacteur'])
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createConsultantSchema)) dto: CreateConsultantDto,
  ) {
    return this.consultants.create(user.id, dto);
  }

  @Patch(':id')
  @Roles(['admin', 'redacteur'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateConsultantSchema)) dto: UpdateConsultantDto,
  ) {
    return this.consultants.update(id, dto);
  }

  @Delete(':id')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.consultants.remove(id);
  }

  @Post('import/text')
  @Roles(['admin', 'redacteur'])
  @HttpCode(200)
  importFromText(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(importConsultantFromTextSchema))
    dto: ImportConsultantFromTextDto,
  ) {
    return this.consultants.importFromText(user.id, dto);
  }

  @Post('import/file')
  @Roles(['admin', 'redacteur'])
  @UseInterceptors(FilesInterceptor('files', 10))
  importFromFile(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('template', new ZodValidationPipe(cvTemplateSchema))
    template: CvTemplateValue,
  ) {
    return this.imports.createBulkImports(user.id, files, template);
  }

  @Get('import-jobs/:jobId')
  getImportJob(@Param('jobId') jobId: string, @CurrentUser() user: AuthUser) {
    return this.imports.getJob(jobId, user.id);
  }

  @Sse('import-jobs/:jobId/events')
  async watchImportJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Observable<MessageEvent>> {
    const job = await this.imports.getJob(jobId, user.id);
    const toEvent = (data: object): MessageEvent => ({ data });

    if (job.status === 'done' || job.status === 'failed') {
      return of(
        toEvent({
          kind: job.kind,
          status: job.status,
          template: job.template,
          consultantId: job.consultantId,
          error: job.error,
        }),
      );
    }

    return concat(
      of(toEvent({ kind: job.kind, status: job.status, template: job.template })),
      this.importEvents.watch(jobId).pipe(map(toEvent)),
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/consultants/consultants.controller.ts
git commit -m "feat(api): ConsultantsController with new endpoints"
```

---

### Task 2.9: Update `CvImportService` (template field no longer used for auto-PDF)

**Files:**
- Modify: `apps/api/src/modules/consultants/cv-import.service.ts`

- [ ] **Step 1: Inspect the current service**

Open and read the file. Identify references to `consultantCvId` (rename to `consultantId`) and any reference to `generatedCvId` (keep, still valid).

- [ ] **Step 2: Apply minimal edits**

For each Prisma call: replace `consultantCv: ...` includes with `consultant: ...`. Replace `consultantCvId` field with `consultantId`. The `template` field stays (used by import payload — purely informational now, no auto-PDF triggered).

- [ ] **Step 3: Verify build**

Run: `nx run api:build`
Expected: only the module file errors remain.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/consultants/cv-import.service.ts
git commit -m "feat(api): cv-import.service uses consultantId"
```

---

### Task 2.10: Rename `consultant-cvs.module.ts` → wire up new modules

**Files:**
- Rename: `apps/api/src/modules/consultants/consultant-cvs.module.ts` → `consultants.module.ts`
- Create: `apps/api/src/modules/cv-variants/cv-variants.module.ts`

- [ ] **Step 1: Rename the consultants module**

Run: `git mv apps/api/src/modules/consultants/consultant-cvs.module.ts apps/api/src/modules/consultants/consultants.module.ts`

- [ ] **Step 2: Replace its content**

```ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConsultantsController } from './consultants.controller';
import { ConsultantsService } from './consultants.service';
import { CvImportEventService } from './cv-import-event.service';
import { CvImportService } from './cv-import.service';
import { CvImportProcessor } from './cv-import.processor';
import { TemplateFillerService } from './template-filler.service';
import { PdfRendererService } from './pdf-renderer.service';
import { CV_IMPORT_QUEUE } from '../../common/queue/queue.module';

@Module({
  imports: [BullModule.registerQueue({ name: CV_IMPORT_QUEUE })],
  controllers: [ConsultantsController],
  providers: [
    ConsultantsService,
    CvImportService,
    CvImportEventService,
    CvImportProcessor,
    TemplateFillerService,
    PdfRendererService,
  ],
  exports: [
    ConsultantsService,
    TemplateFillerService,
    PdfRendererService,
  ],
})
export class ConsultantsModule {}
```

- [ ] **Step 3: Create the variants module**

Create `apps/api/src/modules/cv-variants/cv-variants.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CvVariantsController } from './cv-variants.controller';
import { CvVariantsService } from './cv-variants.service';
import { CvVariantPdfService } from './cv-variant-pdf.service';
import { GeneratedCvsService } from './generated-cvs.service';
import { ConsultantsModule } from '../consultants/consultants.module';

@Module({
  imports: [ConsultantsModule],
  controllers: [CvVariantsController],
  providers: [
    CvVariantsService,
    CvVariantPdfService,
    GeneratedCvsService,
  ],
  exports: [GeneratedCvsService],
})
export class CvVariantsModule {}
```

- [ ] **Step 4: Update `app.module.ts`**

Open `apps/api/src/app/app.module.ts` (or wherever the app module lives). Replace any `ConsultantCvsModule` import with `ConsultantsModule` and add `CvVariantsModule`.

- [ ] **Step 5: Verify build**

Run: `nx run api:build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/ apps/api/src/app/app.module.ts
git commit -m "feat(api): wire ConsultantsModule and CvVariantsModule"
```

---

### Task 2.11: Run the full API test suite + smoke check

- [ ] **Step 1: Run tests**

Run: `nx run api:test`
Expected: all tests PASS.

- [ ] **Step 2: Start the API and exercise endpoints manually**

Run: `nx run api:serve` (background) and use `curl` to verify:
- `GET /consultants` → `{ items: [], total: 0, page: 1, pageSize: 20 }`
- `POST /consultants/import/text` with a valid CV text (50+ chars) → creates Consultant
- `POST /consultants/<id>/variants` with a valid JobProfile id + template → creates Variant
- `POST /variants/<id>/generated-cvs` → triggers PDF render

Document the curls in your shell history; nothing to commit here.

- [ ] **Step 3: Stop the API**

(no commit)

---

## Phase 3 — Front: core services and models

### Task 3.1: Replace `core/consultant-cvs` with `core/consultants`

**Files:**
- Delete: `apps/front/src/app/core/consultant-cvs/`
- Create: `apps/front/src/app/core/consultants/consultant.model.ts`
- Create: `apps/front/src/app/core/consultants/consultants.service.ts`

- [ ] **Step 1: Inspect the old service to know which methods existed**

Run: `cat apps/front/src/app/core/consultant-cvs/consultants.service.ts`
Note the methods (for reference during migration).

- [ ] **Step 2: Create `consultant.model.ts`**

```ts
import type {
  ConsultantsListQueryDto,
  CreateConsultantDto,
  CvData,
  ImportConsultantFromTextDto,
  UpdateConsultantDto,
} from '@org/schemas';
import type { PaginatedResponse } from '@org/types';

export interface Consultant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string | null;
  yearsExperience: number | null;
  location: string | null;
  masterCvData: CvData;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; email: string; fullName: string | null } | null;
  _count?: { variants: number };
}

export type ConsultantListItem = Omit<Consultant, 'masterCvData'> & {
  _count: { variants: number };
};

export type ConsultantsList = PaginatedResponse<ConsultantListItem>;

export type {
  ConsultantsListQueryDto,
  CreateConsultantDto,
  UpdateConsultantDto,
  ImportConsultantFromTextDto,
};
```

- [ ] **Step 3: Create `consultants.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  Consultant,
  ConsultantsList,
  ConsultantsListQueryDto,
  CreateConsultantDto,
  UpdateConsultantDto,
  ImportConsultantFromTextDto,
} from './consultant.model';

@Injectable({ providedIn: 'root' })
export class ConsultantsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/consultants';

  list(query: ConsultantsListQueryDto) {
    return this.http.get<ConsultantsList>(this.baseUrl, {
      params: { page: String(query.page), pageSize: String(query.pageSize) },
    });
  }

  findOne(id: string) {
    return this.http.get<Consultant>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateConsultantDto) {
    return this.http.post<Consultant>(this.baseUrl, dto);
  }

  update(id: string, dto: UpdateConsultantDto) {
    return this.http.patch<Consultant>(`${this.baseUrl}/${id}`, dto);
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  importFromText(dto: ImportConsultantFromTextDto) {
    return this.http.post<{ consultant: Consultant | null; cvData?: unknown; usage: { tokensUsed: number; modelUsed: string } }>(
      `${this.baseUrl}/import/text`,
      dto,
    );
  }
}
```

- [ ] **Step 4: Delete the old folder**

Run: `git rm -r apps/front/src/app/core/consultant-cvs/`

- [ ] **Step 5: Commit**

```bash
git add apps/front/src/app/core/consultants/
git commit -m "feat(front): replace core/consultant-cvs with core/consultants"
```

---

### Task 3.2: Create `core/cv-variants`

**Files:**
- Create: `apps/front/src/app/core/cv-variants/cv-variant.model.ts`
- Create: `apps/front/src/app/core/cv-variants/cv-variants.service.ts`

- [ ] **Step 1: Create `cv-variant.model.ts`**

```ts
import type {
  CreateCvVariantDto,
  CvData,
  CvTemplateValue,
  UpdateCvVariantDto,
} from '@org/schemas';

export interface GeneratedCvSummary {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  filename: string | null;
  updatedAt: string;
}

export interface CvVariant {
  id: string;
  consultantId: string;
  jobProfileId: string;
  jobProfile: { id: string; title: string; projectId: string | null };
  template: CvTemplateValue;
  name: string;
  cvData: CvData;
  createdAt: string;
  updatedAt: string;
  generatedCvs: GeneratedCvSummary[];
}

export type { CreateCvVariantDto, UpdateCvVariantDto };
```

- [ ] **Step 2: Create `cv-variants.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  CreateCvVariantDto,
  CvVariant,
  GeneratedCvSummary,
  UpdateCvVariantDto,
} from './cv-variant.model';

@Injectable({ providedIn: 'root' })
export class CvVariantsService {
  private readonly http = inject(HttpClient);

  listForConsultant(consultantId: string) {
    return this.http.get<CvVariant[]>(`/api/consultants/${consultantId}/variants`);
  }

  create(consultantId: string, dto: CreateCvVariantDto) {
    return this.http.post<{ variant: CvVariant; usage: { tokensUsed: number; modelUsed: string } }>(
      `/api/consultants/${consultantId}/variants`,
      dto,
    );
  }

  findOne(id: string) {
    return this.http.get<CvVariant>(`/api/variants/${id}`);
  }

  update(id: string, dto: UpdateCvVariantDto) {
    return this.http.patch<CvVariant>(`/api/variants/${id}`, dto);
  }

  remove(id: string) {
    return this.http.delete<void>(`/api/variants/${id}`);
  }

  regenerate(id: string) {
    return this.http.post<{ variant: CvVariant; usage: { tokensUsed: number; modelUsed: string } }>(
      `/api/variants/${id}/regenerate`,
      {},
    );
  }

  triggerPdf(id: string) {
    return this.http.post<GeneratedCvSummary>(
      `/api/variants/${id}/generated-cvs`,
      {},
    );
  }

  downloadPdfUrl(variantId: string, genId: string) {
    return `/api/variants/${variantId}/generated-cvs/${genId}/download`;
  }

  removePdf(variantId: string, genId: string) {
    return this.http.delete<void>(`/api/variants/${variantId}/generated-cvs/${genId}`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/front/src/app/core/cv-variants/
git commit -m "feat(front): add core/cv-variants service + model"
```

---

## Phase 4 — Front: pages and components

### Task 4.1: Build the `ConsultantsStore` (NgRx Signals)

**Files:**
- Create: `apps/front/src/app/pages/cv-formatter/consultants.store.ts`

- [ ] **Step 1: Write the store**

```ts
import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
  withComputed,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ConsultantsService } from '../../core/consultants/consultants.service';
import type { ConsultantListItem } from '../../core/consultants/consultant.model';

interface ConsultantsState {
  items: ConsultantListItem[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
}

const initialState: ConsultantsState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,
};

export const ConsultantsStore = signalStore(
  withState(initialState),
  withComputed(({ total, pageSize }) => ({
    pageCount: computed(() => Math.max(1, Math.ceil(total() / pageSize()))),
  })),
  withMethods((store) => {
    const api = inject(ConsultantsService);
    return {
      async loadPage(page: number, pageSize = store.pageSize()) {
        patchState(store, { loading: true, error: null });
        try {
          const res = await firstValueFrom(api.list({ page, pageSize }));
          patchState(store, {
            items: res.items,
            total: res.total,
            page: res.page,
            pageSize: res.pageSize,
            loading: false,
          });
        } catch (err) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Erreur de chargement',
          });
        }
      },
      async remove(id: string) {
        await firstValueFrom(api.remove(id));
        await this.loadPage(store.page());
      },
    };
  }),
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/consultants.store.ts
git commit -m "feat(front): ConsultantsStore (signal store)"
```

---

### Task 4.2: Build `ConsultantDetailsStore`

**Files:**
- Create: `apps/front/src/app/pages/cv-formatter/consultant-details/consultant-details.store.ts`

- [ ] **Step 1: Write the store**

```ts
import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ConsultantsService } from '../../../core/consultants/consultants.service';
import { CvVariantsService } from '../../../core/cv-variants/cv-variants.service';
import type { Consultant } from '../../../core/consultants/consultant.model';
import type { CreateCvVariantDto, CvVariant, UpdateCvVariantDto } from '../../../core/cv-variants/cv-variant.model';

interface State {
  consultant: Consultant | null;
  variants: CvVariant[];
  loading: boolean;
  error: string | null;
}

const initialState: State = {
  consultant: null,
  variants: [],
  loading: false,
  error: null,
};

export const ConsultantDetailsStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const consultantsApi = inject(ConsultantsService);
    const variantsApi = inject(CvVariantsService);
    return {
      async load(id: string) {
        patchState(store, { loading: true, error: null });
        try {
          const [consultant, variants] = await Promise.all([
            firstValueFrom(consultantsApi.findOne(id)),
            firstValueFrom(variantsApi.listForConsultant(id)),
          ]);
          patchState(store, { consultant, variants, loading: false });
        } catch (err) {
          patchState(store, {
            loading: false,
            error: err instanceof Error ? err.message : 'Erreur de chargement',
          });
        }
      },
      async createVariant(dto: CreateCvVariantDto) {
        const consultant = store.consultant();
        if (!consultant) return;
        const { variant } = await firstValueFrom(variantsApi.create(consultant.id, dto));
        patchState(store, { variants: [variant, ...store.variants()] });
      },
      async regenerateVariant(variantId: string) {
        const { variant } = await firstValueFrom(variantsApi.regenerate(variantId));
        patchState(store, {
          variants: store.variants().map((v) => (v.id === variantId ? variant : v)),
        });
      },
      async updateVariant(variantId: string, dto: UpdateCvVariantDto) {
        const variant = await firstValueFrom(variantsApi.update(variantId, dto));
        patchState(store, {
          variants: store.variants().map((v) => (v.id === variantId ? variant : v)),
        });
      },
      async deleteVariant(variantId: string) {
        await firstValueFrom(variantsApi.remove(variantId));
        patchState(store, {
          variants: store.variants().filter((v) => v.id !== variantId),
        });
      },
    };
  }),
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/consultant-details/consultant-details.store.ts
git commit -m "feat(front): ConsultantDetailsStore"
```

---

### Task 4.3: Build `create-variant-dialog`

**Files:**
- Create: `apps/front/src/app/pages/cv-formatter/create-variant-dialog.ts`

- [ ] **Step 1: Inspect existing dialogs to follow the project pattern**

Run: `cat apps/front/src/app/pages/cv-formatter/generate-cv-dialog.ts`
Note how `Dialog`, `DIALOG_DATA`, and `dialogRef.close(...)` are used.

- [ ] **Step 2: Write the dialog component**

```ts
import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import type { CreateCvVariantDto } from '../../core/cv-variants/cv-variant.model';
import type { CvTemplateValue } from '@org/schemas';

interface JobProfileOption {
  id: string;
  title: string;
}

export interface CreateVariantDialogData {
  consultantId: string;
  consultantLabel: string;
}

@Component({
  selector: 'app-create-variant-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 w-[480px] flex flex-col gap-4">
      <h2 class="text-xl font-semibold">Nouvelle variante de CV</h2>
      <p class="text-sm text-gray-500">Consultant : {{ data.consultantLabel }}</p>

      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium">Fiche de poste</span>
        <select class="border rounded p-2" [value]="jobProfileId()" (change)="onJobChange($event)">
          <option value="">— Sélectionner —</option>
          @for (j of jobs(); track j.id) {
            <option [value]="j.id">{{ j.title }}</option>
          }
        </select>
      </label>

      <div class="flex flex-col gap-1">
        <span class="text-sm font-medium">Template</span>
        <div class="flex gap-4">
          <label class="flex items-center gap-2">
            <input type="radio" name="tpl" value="tekteo" [checked]="template() === 'tekteo'" (change)="template.set('tekteo')" />
            Tekteo
          </label>
          <label class="flex items-center gap-2">
            <input type="radio" name="tpl" value="anonyme" [checked]="template() === 'anonyme'" (change)="template.set('anonyme')" />
            Anonyme
          </label>
        </div>
      </div>

      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium">Nom (optionnel)</span>
        <input
          class="border rounded p-2"
          [placeholder]="autoNamePreview()"
          [value]="name()"
          (input)="name.set(($any($event.target).value))"
        />
      </label>

      <div class="flex justify-end gap-2 pt-2">
        <button class="px-3 py-2 rounded border" (click)="cancel()">Annuler</button>
        <button
          class="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          [disabled]="!canSubmit()"
          (click)="submit()"
        >Créer</button>
      </div>
    </div>
  `,
})
export class CreateVariantDialog {
  protected readonly data = inject<CreateVariantDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<CreateCvVariantDto>>(DialogRef);
  private readonly http = inject(HttpClient);

  protected readonly jobs = signal<JobProfileOption[]>([]);
  protected readonly jobProfileId = signal<string>('');
  protected readonly template = signal<CvTemplateValue>('tekteo');
  protected readonly name = signal<string>('');

  protected readonly canSubmit = computed(() => this.jobProfileId().length > 0);

  protected readonly autoNamePreview = computed(() => {
    const job = this.jobs().find((j) => j.id === this.jobProfileId());
    const label = this.template() === 'tekteo' ? 'Tekteo' : 'Anonyme';
    if (!job) return `<titre du job> — ${label} — auto`;
    return `${job.title} — ${label} — auto`;
  });

  constructor() {
    void this.loadJobs();
  }

  private async loadJobs() {
    const list = await firstValueFrom(
      this.http.get<{ items: JobProfileOption[] } | JobProfileOption[]>('/api/job-profiles'),
    );
    const items = Array.isArray(list) ? list : list.items;
    this.jobs.set(items.map((j) => ({ id: j.id, title: j.title })));
  }

  protected onJobChange(ev: Event) {
    this.jobProfileId.set(($any(ev.target).value as string) ?? '');
  }

  protected cancel() {
    this.dialogRef.close();
  }

  protected submit() {
    if (!this.canSubmit()) return;
    const dto: CreateCvVariantDto = {
      jobProfileId: this.jobProfileId(),
      template: this.template(),
      ...(this.name().trim() ? { name: this.name().trim() } : {}),
    };
    this.dialogRef.close(dto);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/create-variant-dialog.ts
git commit -m "feat(front): create-variant-dialog (CDK)"
```

---

### Task 4.4: Build `variants-list` presentational component

**Files:**
- Create: `apps/front/src/app/pages/cv-formatter/consultant-details/variants-list/variants-list.ts`

- [ ] **Step 1: Write the component**

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { CvVariant } from '../../../../core/cv-variants/cv-variant.model';

@Component({
  selector: 'app-variants-list',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr class="text-left border-b">
          <th class="py-2">Nom</th>
          <th>Fiche de poste</th>
          <th>Template</th>
          <th>Dernière modif.</th>
          <th>Statut PDF</th>
          <th class="w-px"></th>
        </tr>
      </thead>
      <tbody>
        @for (v of variants(); track v.id) {
          <tr class="border-b hover:bg-gray-50">
            <td class="py-2">
              <a class="text-blue-600 hover:underline" [routerLink]="['/cv-formatter', 'variants', v.id]">
                {{ v.name }}
              </a>
            </td>
            <td>{{ v.jobProfile.title }}</td>
            <td>{{ v.template }}</td>
            <td>{{ v.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</td>
            <td>{{ v.generatedCvs[0]?.status ?? '—' }}</td>
            <td class="whitespace-nowrap">
              <button class="px-2 py-1 text-xs border rounded mr-1" (click)="regenerate.emit(v.id)">Régénérer</button>
              <button class="px-2 py-1 text-xs border rounded mr-1" (click)="generatePdf.emit(v.id)">PDF</button>
              <button class="px-2 py-1 text-xs border rounded text-red-600" (click)="delete.emit(v.id)">Supprimer</button>
            </td>
          </tr>
        }
        @empty {
          <tr><td colspan="6" class="py-6 text-center text-gray-500">Aucune variante. Créez-en une depuis « Nouvelle variante ».</td></tr>
        }
      </tbody>
    </table>
  `,
})
export class VariantsList {
  readonly variants = input.required<CvVariant[]>();
  readonly regenerate = output<string>();
  readonly generatePdf = output<string>();
  readonly delete = output<string>();
}
```

Note: `RouterLink` needs to be added to imports. Update the imports array to `[DatePipe, RouterLink]` and add `import { RouterLink } from '@angular/router';`.

- [ ] **Step 2: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/consultant-details/variants-list/
git commit -m "feat(front): variants-list presentational component"
```

---

### Task 4.5: Build `consultant-details.page`

**Files:**
- Create: `apps/front/src/app/pages/cv-formatter/consultant-details/consultant-details.page.ts`

- [ ] **Step 1: Write the page component**

```ts
import { ChangeDetectionStrategy, Component, inject, OnInit, input } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { ConsultantDetailsStore } from './consultant-details.store';
import { VariantsList } from './variants-list/variants-list';
import { CreateVariantDialog, type CreateVariantDialogData } from '../create-variant-dialog';
import { CvVariantsService } from '../../../core/cv-variants/cv-variants.service';
import type { CreateCvVariantDto } from '../../../core/cv-variants/cv-variant.model';

@Component({
  selector: 'app-consultant-details',
  imports: [RouterLink, VariantsList],
  providers: [ConsultantDetailsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 flex flex-col gap-6">
      <a routerLink="/cv-formatter" class="text-sm text-blue-600 hover:underline">← Retour à la liste</a>

      @if (store.loading()) {
        <p>Chargement…</p>
      } @else if (store.error(); as err) {
        <p class="text-red-600">{{ err }}</p>
      } @else if (store.consultant(); as c) {
        <header class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-semibold">{{ c.firstName }} {{ c.lastName }}</h1>
            <p class="text-gray-600">{{ c.role ?? 'Rôle non renseigné' }}</p>
            <p class="text-sm text-gray-500">{{ c.email }}{{ c.phone ? ' · ' + c.phone : '' }}</p>
          </div>
          <button class="px-3 py-2 rounded bg-blue-600 text-white" (click)="openCreateVariant()">
            Nouvelle variante
          </button>
        </header>

        <section>
          <h2 class="text-lg font-medium mb-2">Variantes</h2>
          <app-variants-list
            [variants]="store.variants()"
            (regenerate)="onRegenerate($event)"
            (generatePdf)="onGeneratePdf($event)"
            (delete)="onDelete($event)"
          />
        </section>
      }
    </div>
  `,
})
export class ConsultantDetailsPage implements OnInit {
  readonly id = input.required<string>();
  protected readonly store = inject(ConsultantDetailsStore);
  private readonly dialog = inject(Dialog);
  private readonly variantsApi = inject(CvVariantsService);

  ngOnInit() {
    void this.store.load(this.id());
  }

  protected async openCreateVariant() {
    const consultant = this.store.consultant();
    if (!consultant) return;
    const ref = this.dialog.open<CreateCvVariantDto | undefined, CreateVariantDialogData>(
      CreateVariantDialog,
      {
        data: {
          consultantId: consultant.id,
          consultantLabel: `${consultant.firstName} ${consultant.lastName}`,
        },
      },
    );
    const result = await firstValueFrom(ref.closed);
    if (result) {
      await this.store.createVariant(result);
    }
  }

  protected onRegenerate(id: string) {
    void this.store.regenerateVariant(id);
  }

  protected async onGeneratePdf(id: string) {
    await firstValueFrom(this.variantsApi.triggerPdf(id));
    await this.store.load(this.id());
  }

  protected onDelete(id: string) {
    if (!confirm('Supprimer cette variante ?')) return;
    void this.store.deleteVariant(id);
  }
}
```

- [ ] **Step 2: Use the `withComponentInputBinding` router feature**

Open `apps/front/src/app/app.config.ts`. Ensure `provideRouter(routes, withComponentInputBinding())` is configured so the `id` route param is bound to the `input.required<string>()` on the page. If not present, add `withComponentInputBinding`.

- [ ] **Step 3: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/consultant-details/consultant-details.page.ts apps/front/src/app/app.config.ts
git commit -m "feat(front): consultant-details page"
```

---

### Task 4.6: Update the routes

**Files:**
- Modify: `apps/front/src/app/app.routes.ts` (or wherever cv-formatter routes are declared)

- [ ] **Step 1: Locate the routes file**

Run: `grep -rn "cv-formatter" apps/front/src/app --include="*.ts" -l`
Expected: at least one routes file. Open it.

- [ ] **Step 2: Replace cv-formatter routes**

Replace any existing block with:

```ts
{
  path: 'cv-formatter',
  loadComponent: () =>
    import('./pages/cv-formatter/cv-formatter.page').then((m) => m.CvFormatterPage),
},
{
  path: 'cv-formatter/consultants/:id',
  loadComponent: () =>
    import('./pages/cv-formatter/consultant-details/consultant-details.page').then(
      (m) => m.ConsultantDetailsPage,
    ),
},
{
  path: 'cv-formatter/variants/:id',
  loadComponent: () =>
    import('./pages/cv-formatter/variant-details/variant-details.page').then(
      (m) => m.VariantDetailsPage,
    ),
},
```

(The `variant-details` route refers to a page built in the next task.)

- [ ] **Step 3: Commit**

```bash
git add apps/front/src/app/app.routes.ts
git commit -m "feat(front): routes for consultant-details and variant-details"
```

---

### Task 4.7: Build `variant-details.page`

**Files:**
- Create: `apps/front/src/app/pages/cv-formatter/variant-details/variant-details.page.ts`
- Create: `apps/front/src/app/pages/cv-formatter/variant-details/variant-details.store.ts`

- [ ] **Step 1: Write the store**

```ts
import { inject } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { CvVariantsService } from '../../../core/cv-variants/cv-variants.service';
import type { CvVariant } from '../../../core/cv-variants/cv-variant.model';

interface State { variant: CvVariant | null; loading: boolean; error: string | null; }

const initial: State = { variant: null, loading: false, error: null };

export const VariantDetailsStore = signalStore(
  withState(initial),
  withMethods((store) => {
    const api = inject(CvVariantsService);
    return {
      async load(id: string) {
        patchState(store, { loading: true, error: null });
        try {
          const variant = await firstValueFrom(api.findOne(id));
          patchState(store, { variant, loading: false });
        } catch (err) {
          patchState(store, { loading: false, error: err instanceof Error ? err.message : 'Erreur' });
        }
      },
      async saveName(name: string) {
        const v = store.variant();
        if (!v) return;
        const updated = await firstValueFrom(api.update(v.id, { name }));
        patchState(store, { variant: updated });
      },
      async saveCvData(cvData: CvVariant['cvData']) {
        const v = store.variant();
        if (!v) return;
        const updated = await firstValueFrom(api.update(v.id, { cvData }));
        patchState(store, { variant: updated });
      },
      async regenerate() {
        const v = store.variant();
        if (!v) return;
        const { variant } = await firstValueFrom(api.regenerate(v.id));
        patchState(store, { variant });
      },
      async triggerPdf() {
        const v = store.variant();
        if (!v) return;
        await firstValueFrom(api.triggerPdf(v.id));
        await this.load(v.id);
      },
    };
  }),
);
```

- [ ] **Step 2: Write the page**

```ts
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { VariantDetailsStore } from './variant-details.store';
import { CvVariantsService } from '../../../core/cv-variants/cv-variants.service';

@Component({
  selector: 'app-variant-details',
  imports: [RouterLink, DatePipe],
  providers: [VariantDetailsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 flex flex-col gap-4">
      <a routerLink="/cv-formatter" class="text-sm text-blue-600 hover:underline">← Retour</a>

      @if (store.loading()) {
        <p>Chargement…</p>
      } @else if (store.error(); as err) {
        <p class="text-red-600">{{ err }}</p>
      } @else if (store.variant(); as v) {
        <header class="flex justify-between items-start">
          <div class="flex-1">
            <input
              class="text-xl font-semibold w-full border rounded px-2 py-1"
              [value]="nameDraft()"
              (input)="nameDraft.set($any($event.target).value)"
              (blur)="saveName()"
            />
            <p class="text-sm text-gray-500">Fiche de poste : {{ v.jobProfile.title }} · Template : {{ v.template }}</p>
            <p class="text-xs text-gray-400">Modifiée le {{ v.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</p>
          </div>
          <div class="flex gap-2">
            <button class="px-3 py-2 rounded border" (click)="store.regenerate()">Régénérer (IA)</button>
            <button class="px-3 py-2 rounded bg-blue-600 text-white" (click)="store.triggerPdf()">Générer PDF</button>
          </div>
        </header>

        <section>
          <h2 class="text-lg font-medium">Contenu (cvData)</h2>
          <textarea
            class="w-full h-96 font-mono text-xs border rounded p-2"
            [value]="cvDataDraft()"
            (input)="cvDataDraft.set($any($event.target).value)"
          ></textarea>
          <button class="mt-2 px-3 py-2 rounded bg-green-600 text-white" (click)="saveCvData()">
            Enregistrer les modifications
          </button>
        </section>

        <section>
          <h2 class="text-lg font-medium">Fichiers PDF générés</h2>
          @for (g of v.generatedCvs; track g.id) {
            <div class="flex items-center gap-3 py-2 border-b">
              <span>{{ g.filename ?? g.id }}</span>
              <span class="text-xs text-gray-500">{{ g.status }}</span>
              @if (g.status === 'success') {
                <a class="text-blue-600 underline" [href]="downloadUrl(v.id, g.id)">Télécharger</a>
              }
            </div>
          } @empty {
            <p class="text-gray-500 text-sm">Aucun PDF généré pour cette variante.</p>
          }
        </section>
      }
    </div>
  `,
})
export class VariantDetailsPage implements OnInit {
  readonly id = input.required<string>();
  protected readonly store = inject(VariantDetailsStore);
  private readonly api = inject(CvVariantsService);
  protected readonly nameDraft = signal<string>('');
  protected readonly cvDataDraft = signal<string>('');

  constructor() {
    effect(() => {
      const v = this.store.variant();
      if (v) {
        this.nameDraft.set(v.name);
        this.cvDataDraft.set(JSON.stringify(v.cvData, null, 2));
      }
    });
  }

  ngOnInit() {
    void this.store.load(this.id());
  }

  protected saveName() {
    void this.store.saveName(this.nameDraft());
  }

  protected saveCvData() {
    try {
      const parsed = JSON.parse(this.cvDataDraft());
      void this.store.saveCvData(parsed);
    } catch {
      alert('JSON invalide');
    }
  }

  protected downloadUrl(variantId: string, genId: string) {
    return this.api.downloadPdfUrl(variantId, genId);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/variant-details/
git commit -m "feat(front): variant-details page"
```

---

### Task 4.8: Rewire `cv-formatter.page` (list of consultants)

**Files:**
- Modify: `apps/front/src/app/pages/cv-formatter/cv-formatter.page.ts`

- [ ] **Step 1: Inspect the current page**

Run: `cat apps/front/src/app/pages/cv-formatter/cv-formatter.page.ts`

- [ ] **Step 2: Replace its body with a Consultant-list-driven page**

```ts
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ConsultantsStore } from './consultants.store';

@Component({
  selector: 'app-cv-formatter',
  imports: [RouterLink, DatePipe],
  providers: [ConsultantsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 flex flex-col gap-6">
      <header class="flex justify-between items-center">
        <h1 class="text-2xl font-semibold">Consultants</h1>
        <!-- Bouton "Importer un CV" laissé au cv-import-section existant (à recâbler en Task 4.9) -->
      </header>

      @if (store.loading()) {
        <p>Chargement…</p>
      } @else {
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="text-left border-b">
              <th class="py-2">Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Variantes</th>
              <th>Créé le</th>
            </tr>
          </thead>
          <tbody>
            @for (c of store.items(); track c.id) {
              <tr class="border-b hover:bg-gray-50">
                <td class="py-2">
                  <a class="text-blue-600 hover:underline" [routerLink]="['/cv-formatter', 'consultants', c.id]">
                    {{ c.firstName }} {{ c.lastName }}
                  </a>
                </td>
                <td>{{ c.email }}</td>
                <td>{{ c.role ?? '—' }}</td>
                <td>{{ c._count.variants }}</td>
                <td>{{ c.createdAt | date: 'dd/MM/yyyy' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="py-6 text-center text-gray-500">Aucun consultant. Importez un CV pour commencer.</td></tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class CvFormatterPage implements OnInit {
  protected readonly store = inject(ConsultantsStore);

  ngOnInit() {
    void this.store.loadPage(1);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/cv-formatter.page.ts
git commit -m "feat(front): cv-formatter page lists consultants"
```

---

### Task 4.9: Update `cv-import-section` to call new endpoint

**Files:**
- Modify: `apps/front/src/app/pages/cv-formatter/cv-import-section/`

- [ ] **Step 1: Inspect**

Run: `ls apps/front/src/app/pages/cv-formatter/cv-import-section/`
Then read the main `.ts` file. Identify calls to the old `consultants.service` (text import + file import).

- [ ] **Step 2: Update calls**

- Replace text import: call `ConsultantsService.importFromText(dto)` → endpoint `/api/consultants/import/text`. If the old service had a method like `formatFromText`, rename the call.
- Replace file import: call `POST /api/consultants/import/file` (multipart). If the old service wraps this, update its URL accordingly.
- After successful import, navigate to `/cv-formatter/consultants/<id>` instead of the legacy `cv-details`.

- [ ] **Step 3: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/cv-import-section/
git commit -m "feat(front): cv-import-section uses new consultant endpoints"
```

---

### Task 4.10: Update `consultant-manual-form` for the new Consultant DTO

**Files:**
- Modify: `apps/front/src/app/pages/cv-formatter/consultant-manual-form/`

- [ ] **Step 1: Inspect**

Run: `ls apps/front/src/app/pages/cv-formatter/consultant-manual-form/`
Read the component.

- [ ] **Step 2: Adapt the form**

Use Signal Forms (`form()`, `FormRoot`, `FormField`) to build fields for the new `CreateConsultantDto`:
- `firstName` (required, max 100)
- `lastName` (required, max 100)
- `email` (required, email)
- `phone` (optional)
- `role` (optional)
- `yearsExperience` (optional, number)
- `location` (optional)
- `masterCvData` (the structured CV editor — reuse the existing editor sub-component, if any, that edited `cvData` previously)

On submit, call `ConsultantsService.create(dto)`, then navigate to `/cv-formatter/consultants/<id>`.

- [ ] **Step 3: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/consultant-manual-form/
git commit -m "feat(front): consultant-manual-form for new Consultant DTO"
```

---

### Task 4.11: Update `consultant-list-section` (if still used) or remove

**Files:**
- Modify or delete: `apps/front/src/app/pages/cv-formatter/consultant-list-section/`

- [ ] **Step 1: Check if the page replaces this**

Since `cv-formatter.page.ts` already lists consultants (Task 4.8), `consultant-list-section/` may be redundant. Read its contents.

- [ ] **Step 2: Decision**

- If it duplicates `cv-formatter.page`, delete the folder and remove its imports.
- If it's a sub-section embedded elsewhere, update its data source to `ConsultantsStore`.

- [ ] **Step 3: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/
git commit -m "refactor(front): consolidate consultant list rendering"
```

---

### Task 4.12: Recâble `generate-cv-dialog` on variantId

**Files:**
- Modify: `apps/front/src/app/pages/cv-formatter/generate-cv-dialog.ts`

- [ ] **Step 1: Inspect**

Run: `cat apps/front/src/app/pages/cv-formatter/generate-cv-dialog.ts`

- [ ] **Step 2: Update**

If the dialog still triggers PDF rendering, point it at `CvVariantsService.triggerPdf(variantId)` instead of the old consultant endpoint. If the dialog is no longer used (the `variant-details` page has its own button), delete the file and references.

- [ ] **Step 3: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/
git commit -m "feat(front): generate-cv-dialog uses variantId"
```

---

### Task 4.13: Delete obsolete `cv-details` page

**Files:**
- Delete: `apps/front/src/app/pages/cv-formatter/cv-details/`

- [ ] **Step 1: Verify it's no longer referenced**

Run: `grep -rn "cv-details" apps/front/src --include="*.ts"`
Expected: only references inside the folder itself.

- [ ] **Step 2: Delete**

Run: `git rm -r apps/front/src/app/pages/cv-formatter/cv-details/`

- [ ] **Step 3: Verify build**

Run: `nx run front:build`
Expected: PASS (or fix remaining residual references).

- [ ] **Step 4: Commit**

```bash
git add apps/front/src/app/pages/cv-formatter/
git commit -m "chore(front): drop obsolete cv-details page"
```

---

### Task 4.14: Run the full test suite + manual UI smoke test

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 2: Start the front and exercise the flow**

Run: `nx run front:serve` (background). In a browser:
1. Open `/cv-formatter` → list is empty
2. Import a CV (text or file) → consultant created, redirected to `/cv-formatter/consultants/<id>`
3. Click « Nouvelle variante » → dialog opens with JobProfile + template picker
4. Submit → variant appears in the variants list
5. Click the variant name → variant-details page opens
6. Click « Générer PDF » → PDF appears in the list
7. Click « Télécharger » → file downloads
8. Click « Régénérer (IA) » → cvData refreshes
9. Edit a field in the cvData textarea → save → reload page → changes persisted
10. Back to consultant detail → delete variant → it disappears
11. Back to list → delete consultant → it disappears

Document any UI/UX issues found. Fix them in a follow-up commit.

- [ ] **Step 3: Stop the front**

---

## Phase 5 — Cleanup

### Task 5.1: Search for residual `ConsultantCv` references

**Files:** all

- [ ] **Step 1: Search**

Run: `grep -rn "consultantCv\|ConsultantCv\|consultant-cvs\|adaptToJob\|formatFromText\|adapt-to-job" apps/ libs/ --include="*.ts"`
Expected: zero hits, or only safe ones (e.g., migrations folder which we keep).

- [ ] **Step 2: Fix any remaining ones**

Replace each manually based on context (consultant → `consultants`, variant → `cv-variants`, etc.).

- [ ] **Step 3: Verify both apps build**

Run: `nx run api:build && nx run front:build`
Expected: PASS.

- [ ] **Step 4: Commit (if changes made)**

```bash
git add -p
git commit -m "chore: remove residual ConsultantCv references"
```

---

### Task 5.2: Update `CLAUDE.md` if needed

**Files:**
- Modify: `CLAUDE.md` (only if it mentions `ConsultantCv` or `adaptToJob`)

- [ ] **Step 1: Search**

Run: `grep -n "ConsultantCv\|adaptToJob" CLAUDE.md`
Expected: zero hits.

- [ ] **Step 2: If hits, update**

Edit the references. Otherwise, skip this task.

---

### Task 5.3: Final end-to-end check

- [ ] **Step 1: Run all the things**

Run: `nx run api:build && nx run api:test && nx run front:build && npm test`
Expected: all PASS.

- [ ] **Step 2: Manual smoke**

Repeat the full flow from Task 4.14, end to end, in a clean session.

- [ ] **Step 3: Commit if any small fixes were made**

```bash
git add -p
git commit -m "chore: final polish"
```

---

## Acceptance criteria (from spec)

After Phase 5 completes, verify all 10 criteria from the spec:

1. ✅ A consultant has a unique identity (`email` unique) and a `masterCvData`
2. ✅ The consultants list **no longer** shows duplicates from AI adaptations
3. ✅ Creating a variant from `master + JobProfile + template` works; master is untouched
4. ✅ Regenerating a variant overwrites its `cvData` without touching master or sibling variants
5. ✅ Editing a variant's `cvData` manually persists
6. ✅ Deleting a JobProfile cascades its variants and their PDFs (storage purged)
7. ✅ Deleting a consultant cascades variants + PDFs
8. ✅ A generated PDF is attached to a precise variant and downloadable
9. ✅ Auto-generated variant name follows `{title} — {templateLabel} — {YYYY-MM-DD HH:mm}` and is editable
10. ✅ `generation_history` records `module: 'cv'` with discriminating `mode`
