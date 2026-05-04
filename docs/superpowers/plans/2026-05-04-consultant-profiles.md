# Consultants & génération de CV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la feature CV pour proposer (a) l'import multi-fichier de CV PDF/DOCX, (b) une création manuelle via formulaire complet, et (c) la génération de PDF par template HTML (Claude remplit + Puppeteer rend), avec gestion d'historique des CV générés par profil.

**Architecture:** Côté API Nest, on ajoute une table `generated_cvs` (1:N depuis `consultant_cvs`), on étend `cv_import_jobs` avec un discriminator `kind: 'import' | 'generate'`, on ajoute un service de remplissage Claude + un service de rendu Puppeteer, et on étend le processor Bull pour exécuter le pipeline complet (extraction → fill → render → store). Côté Angular, on refond `CvFormatterPage` avec un système de tabs (import multi-fichier vs formulaire manuel), une liste paginée avec badges contextuels, et on étend `CvDetailPage` avec une section « CVs générés ».

**Tech Stack:** NestJS, Prisma, BullMQ (existant), Puppeteer (nouveau), Anthropic SDK (existant, avec prompt caching sur les templates), Zod (`@org/schemas`), Angular 21+ signals (`rxResource`, `signal()`, signal forms), Tailwind, Material `Dialog`.

**Note on commits:** Chaque tâche se termine par une suggestion de commit. Conformément à la règle utilisateur, **ne JAMAIS exécuter `git commit` automatiquement** — proposer le message et attendre l'accord.

**Spec :** `docs/superpowers/specs/2026-05-04-consultant-profiles-design.md`

---

## File map

**Created (backend):**
- `apps/api/src/modules/consultant-cvs/cv-template-prompts.ts`
- `apps/api/src/modules/consultant-cvs/template-filler.service.ts`
- `apps/api/src/modules/consultant-cvs/pdf-renderer.service.ts`
- `apps/api/src/modules/consultant-cvs/generated-cvs.service.ts`
- `apps/api/prisma/migrations/<timestamp>_consultant_profiles/migration.sql` (généré par Prisma)

**Modified (backend):**
- `apps/api/prisma/schema.prisma` (nouvelle table + enums + évolutions)
- `apps/api/src/modules/consultant-cvs/cv-import.service.ts` (multi-fichier + payload `kind`)
- `apps/api/src/modules/consultant-cvs/cv-import.processor.ts` (pipeline complet)
- `apps/api/src/modules/consultant-cvs/consultant-cvs.service.ts` (pagination + `latestGeneratedCv` + cleanup)
- `apps/api/src/modules/consultant-cvs/consultant-cvs.controller.ts` (nouveaux endpoints)
- `apps/api/src/modules/consultant-cvs/consultant-cvs.module.ts` (wiring nouveaux services)
- `libs/shared/schemas/src/lib/schemas.ts` (nouveaux schémas)

**Created (front):**
- `apps/front/src/app/pages/cv-formatter/multi-file-import-zone.ts`
- `apps/front/src/app/pages/cv-formatter/multi-file-import-zone.html`
- `apps/front/src/app/pages/cv-formatter/consultant-manual-form.ts`
- `apps/front/src/app/pages/cv-formatter/consultant-manual-form.html`
- `apps/front/src/app/pages/cv-formatter/generate-cv-dialog.ts`
- `apps/front/src/app/pages/cv-formatter/generated-cv-list.ts`
- `apps/front/src/app/pages/cv-formatter/generated-cv-list.html`

**Modified (front):**
- `apps/front/src/app/core/consultant-cvs/consultant-cvs.service.ts` (nouvelles méthodes)
- `apps/front/src/app/core/consultant-cvs/consultant-cv.model.ts` (nouveaux types)
- `apps/front/src/app/pages/cv-formatter/cv-formatter.page.ts` (refonte)
- `apps/front/src/app/pages/cv-formatter/cv-formatter.page.html` (refonte)
- `apps/front/src/app/pages/cv-formatter/cv-detail.page.ts` (section CVs générés)
- `apps/front/src/app/pages/cv-formatter/cv-detail.page.html` (section CVs générés)

**Deleted (front):**
- `apps/front/src/app/pages/cv-formatter/cv-import.page.ts` (mono-fichier — remplacé)
- `apps/front/src/app/pages/cv-formatter/cv-import.page.html`

---

# PHASE 1 — Schémas partagés & migration DB

## Task 1: Shared Zod schemas + types

**Files:**
- Modify: `libs/shared/schemas/src/lib/schemas.ts` (append + amend)

- [ ] **Step 1: Ajouter les nouveaux schémas Dashboard à `libs/shared/schemas/src/lib/schemas.ts`**

Repérer la section `// CV Import (PDF/DOCX → CvData via worker IA)` (ligne ~365) et **remplacer** l'enum `cvImportTemplateSchema` ainsi que les types associés. Voici les ajouts à effectuer **après** le `cvImportStatusSchema` existant :

```ts
// ============================================================
// CV templates & génération PDF
// ============================================================

export const cvTemplateSchema = z.enum(['tekteo', 'anonyme']);
export type CvTemplateValue = z.infer<typeof cvTemplateSchema>;

export const cvJobKindSchema = z.enum(['import', 'generate']);
export type CvJobKindValue = z.infer<typeof cvJobKindSchema>;

export const cvGenerationStatusSchema = z.enum([
  'pending',
  'processing',
  'success',
  'failed',
]);
export type CvGenerationStatusValue = z.infer<typeof cvGenerationStatusSchema>;

export const generatedCvSchema = z.object({
  id: z.uuid(),
  template: cvTemplateSchema,
  status: cvGenerationStatusSchema,
  filename: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type GeneratedCvDto = z.infer<typeof generatedCvSchema>;

// Body POST /consultant-cvs/:id/generate
export const generateCvFromTemplateSchema = z.object({
  template: cvTemplateSchema,
});
export type GenerateCvFromTemplateDto = z.infer<
  typeof generateCvFromTemplateSchema
>;

// Body POST /consultant-cvs/import-from-file (multi)
// Validé côté contrôleur Nest (multipart, files[] + template)
export const importCvBodySchema = z.object({
  template: cvTemplateSchema,
});

// SSE — discriminated union par `kind`
export const cvJobEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('import'),
    jobId: z.uuid(),
    status: cvImportStatusSchema,
    template: cvTemplateSchema,
    consultantId: z.uuid().nullable(),
    generatedCvId: z.uuid().nullable(),
    error: z.string().nullable(),
  }),
  z.object({
    kind: z.literal('generate'),
    jobId: z.uuid(),
    status: cvImportStatusSchema,
    template: cvTemplateSchema,
    consultantId: z.uuid(),
    generatedCvId: z.uuid().nullable(),
    error: z.string().nullable(),
  }),
]);
export type CvJobEventDto = z.infer<typeof cvJobEventSchema>;

// Pagination
export const consultantCvsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ConsultantCvsListQueryDto = z.infer<
  typeof consultantCvsListQuerySchema
>;
```

- [ ] **Step 2: Durcir `createConsultantCvSchema`**

Dans le même fichier, **remplacer** la définition de `createConsultantCvSchema` (ligne ~334) par :

```ts
export const createConsultantCvSchema = z.object({
  cvData: cvDataSchema,
  consultantName: z
    .string()
    .min(1, { message: 'Le nom est requis' })
    .max(200),
  consultantTitle: z
    .string()
    .min(1, { message: 'L\'intitulé est requis' })
    .max(200),
});
export type CreateConsultantCvDto = z.infer<typeof createConsultantCvSchema>;
```

`updateConsultantCvSchema = createConsultantCvSchema.partial()` reste inchangé (les champs deviennent optionnels en patch).

- [ ] **Step 3: Migrer l'enum `cvImportTemplateSchema`**

L'enum actuel `z.enum(['modern', 'classic'])` n'est plus utilisé. Le **garder** pour compatibilité backend si besoin (le champ Prisma migre vers la nouvelle enum mais des helpers peuvent encore référencer l'ancien type). Pas de changement nécessaire ici — la nouvelle enum `cvTemplateSchema` est ajoutée à côté.

- [ ] **Step 4: Vérifier la compilation des schémas**

```bash
npx nx build schemas
```

Expected: build succeeds.

- [ ] **Step 5: Commit (ASK USER FIRST)**

Suggested message:
```
feat(schemas): add cv template, generation and pagination schemas
```

---

## Task 2: Prisma migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Generated: `apps/api/prisma/migrations/<timestamp>_consultant_profiles/migration.sql`

- [ ] **Step 1: Modifier `schema.prisma` — ajout des enums**

À ajouter dans la section enums (cherche les autres `enum` existants pour la cohérence) :

```prisma
enum CvTemplate {
  tekteo
  anonyme

  @@map("cv_template")
}

enum CvGenerationStatus {
  pending
  processing
  success
  failed

  @@map("cv_generation_status")
}

enum CvJobKind {
  import
  generate

  @@map("cv_job_kind")
}
```

- [ ] **Step 2: Modifier `ConsultantCv` (ajout `updatedAt` + relation `generatedCvs`)**

Repérer le model `ConsultantCv` (ligne ~339) et **remplacer** par :

```prisma
model ConsultantCv {
  id              String   @id @default(uuid())
  cvData          Json     @map("cv_data")
  consultantName  String?  @map("consultant_name")
  consultantTitle String?  @map("consultant_title")
  createdById     String?  @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt      @map("updated_at")

  createdBy    User?         @relation("CvCreator", fields: [createdById], references: [id], onDelete: SetNull)
  jobProfiles  JobProfile[]
  importJobs   CvImportJob[]
  generatedCvs GeneratedCv[]

  @@map("consultant_cvs")
}
```

- [ ] **Step 3: Ajouter le model `GeneratedCv`**

Juste après `ConsultantCv`, ajouter :

```prisma
// ============================================================
// GeneratedCv — PDF rendu via template + Claude + Puppeteer
// ============================================================

model GeneratedCv {
  id           String             @id @default(uuid())
  consultantId String             @map("consultant_id")
  template     CvTemplate
  status       CvGenerationStatus @default(pending)
  outputPath   String?            @map("output_path")
  filename     String?
  errorMessage String?            @map("error_message")
  createdById  String?            @map("created_by")
  createdAt    DateTime           @default(now()) @map("created_at")
  updatedAt    DateTime           @updatedAt      @map("updated_at")

  consultant ConsultantCv @relation(fields: [consultantId], references: [id], onDelete: Cascade)
  createdBy  User?        @relation("GeneratedCvCreator", fields: [createdById], references: [id], onDelete: SetNull)
  jobs       CvImportJob[]

  @@index([consultantId])
  @@index([status])
  @@map("generated_cvs")
}
```

- [ ] **Step 4: Faire évoluer `CvImportJob`**

Repérer le model `CvImportJob` (ligne ~358) et **remplacer** par :

```prisma
model CvImportJob {
  id             String         @id @default(uuid())
  kind           CvJobKind      @default(import)
  userId         String         @map("user_id")
  status         CvImportStatus @default(pending)
  template       CvTemplate     @default(tekteo)
  consultantId   String?        @map("consultant_id")
  generatedCvId  String?        @map("generated_cv_id")
  inputPath      String?        @map("input_path")
  inputFilename  String?        @map("input_filename")
  outputPath     String?        @map("output_path")
  errorMessage   String?        @map("error_message")
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt      @map("updated_at")

  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  consultant  ConsultantCv? @relation(fields: [consultantId], references: [id], onDelete: SetNull)
  generatedCv GeneratedCv?  @relation(fields: [generatedCvId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([status])
  @@index([kind])
  @@map("cv_import_jobs")
}
```

**Note** : on remplace l'ancien `templateId String` par `template CvTemplate`. La relation `cv ConsultantCv?` est renommée en `consultant` (champ `consultantId` à la place de `cvId`).

- [ ] **Step 5: Mettre à jour `User` pour la nouvelle relation inverse**

Repérer le model `User` (ligne ~95) et ajouter dans le bloc des relations CV :

```prisma
generatedCvs GeneratedCv[] @relation("GeneratedCvCreator")
```

- [ ] **Step 6: Générer la migration Prisma**

```bash
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma --name consultant_profiles
```

Expected: nouvelle migration générée dans `apps/api/prisma/migrations/<timestamp>_consultant_profiles/`. Prisma applique la migration sur la base locale.

- [ ] **Step 7: Éditer la migration générée pour remap les anciennes valeurs**

Si la base locale contenait déjà des `cv_import_jobs` avec `template_id = 'modern'` ou `'classic'`, la migration auto va échouer (Postgres refuse de drop la colonne avant d'avoir migré la donnée).

Ajouter en tête du fichier `migration.sql` généré, **avant** les `ALTER TABLE`/`DROP COLUMN` :

```sql
-- Backfill avant suppression de l'ancienne colonne template_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cv_import_jobs' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE cv_import_jobs ADD COLUMN IF NOT EXISTS template cv_template;
    UPDATE cv_import_jobs SET template = 'tekteo' WHERE template_id = 'modern';
    UPDATE cv_import_jobs SET template = 'anonyme' WHERE template_id = 'classic';
    UPDATE cv_import_jobs SET template = 'tekteo' WHERE template IS NULL;
    ALTER TABLE cv_import_jobs ALTER COLUMN template SET NOT NULL;
    ALTER TABLE cv_import_jobs ALTER COLUMN template SET DEFAULT 'tekteo';
    ALTER TABLE cv_import_jobs DROP COLUMN template_id;
  END IF;
END $$;
```

Et de même pour la migration `cvId → consultantId` :

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cv_import_jobs' AND column_name = 'cv_id'
  ) THEN
    ALTER TABLE cv_import_jobs ADD COLUMN IF NOT EXISTS consultant_id TEXT;
    UPDATE cv_import_jobs SET consultant_id = cv_id;
    ALTER TABLE cv_import_jobs DROP CONSTRAINT IF EXISTS "cv_import_jobs_cv_id_fkey";
    ALTER TABLE cv_import_jobs DROP COLUMN cv_id;
  END IF;
END $$;
```

Re-run la migration : `npx prisma migrate reset --schema=apps/api/prisma/schema.prisma --force` (en dev seulement) puis `npx prisma migrate dev`.

- [ ] **Step 8: Régénérer le client Prisma**

```bash
npm run prisma:generate
```

Expected: client régénéré dans `apps/api/src/generated/prisma/`.

- [ ] **Step 9: Build de l'API pour valider la migration**

```bash
npx nx build @org/api
```

Expected: build succeeds. Si erreurs TS, c'est probablement parce que le code utilise encore les anciens noms (`cvId`, `templateId`) — ces erreurs seront corrigées dans les tâches suivantes (3+). On peut laisser ces erreurs ici et les fixer quand on touche les fichiers concernés ; sinon, faire un `git stash` pour voir l'état clean, ce qui n'est pas nécessaire.

**Compromis acceptable** : si le build casse à cause de `cvId`/`templateId`, c'est attendu — la tâche 7 fixera le processor et la tâche 9 fixera le service. Marquer cette étape comme « non-bloquante » et continuer.

- [ ] **Step 10: Commit (ASK USER FIRST)**

Suggested message:
```
feat(api): add generated_cvs table and evolve cv_import_jobs (kind, consultant_id, template enum)
```

---

# PHASE 2 — Backend services & contrôleur

## Task 3: Install Puppeteer + system deps

**Files:**
- Modify: `package.json` (deps)
- Modify: `apps/api/Dockerfile` (si présent)

- [ ] **Step 1: Installer Puppeteer**

```bash
npm install puppeteer
```

Expected: ajouté dans `package.json`. Le téléchargement de Chromium peut prendre 1-2 minutes.

- [ ] **Step 2: Vérifier la présence d'un Dockerfile API**

```bash
ls apps/api/Dockerfile 2>/dev/null && echo "Dockerfile existe" || echo "pas de Dockerfile"
```

Si **présent** : ajouter les libs système avant l'install des deps Node :

```dockerfile
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libgbm1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

Si **absent** : ne rien faire, on documente dans le README plus tard.

- [ ] **Step 3: Smoke test Puppeteer en dev**

Créer temporairement `apps/api/scripts/smoke-puppeteer.ts` :

```ts
import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<h1>Hello Puppeteer</h1>');
  const buffer = await page.pdf({ format: 'A4' });
  console.log('PDF généré :', buffer.length, 'octets');
  await browser.close();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Lancer :

```bash
npx ts-node --transpile-only apps/api/scripts/smoke-puppeteer.ts
```

Expected: `PDF généré : <nombre> octets`. Supprimer le fichier après vérification :

```bash
rm apps/api/scripts/smoke-puppeteer.ts
```

- [ ] **Step 4: Commit (ASK USER FIRST)**

Suggested message:
```
chore(api): add puppeteer dependency for HTML→PDF rendering
```

---

## Task 4: PdfRendererService

**Files:**
- Create: `apps/api/src/modules/consultant-cvs/pdf-renderer.service.ts`

- [ ] **Step 1: Implémenter le service**

Créer `apps/api/src/modules/consultant-cvs/pdf-renderer.service.ts` :

```ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';

const PDF_TIMEOUT_MS = 30_000;

/**
 * Service de rendu HTML → PDF via Puppeteer.
 *
 * Garde une instance Chromium partagée et réutilisable pour
 * éviter le coût de spawn à chaque génération.
 */
@Injectable()
export class PdfRendererService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfRendererService.name);
  private browser: Browser | null = null;

  async onModuleInit(): Promise<void> {
    this.logger.log('🔧 Initialisation du moteur de rendu PDF…');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    this.logger.log('✅ Moteur PDF prêt');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.log('🛑 Moteur PDF arrêté');
    }
  }

  /**
   * Rend un buffer PDF à partir d'un HTML complet.
   * @throws si le moteur n'est pas initialisé ou si la génération échoue.
   */
  async render(html: string): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Moteur PDF non initialisé');
    }
    const page = await this.browser.newPage();
    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: PDF_TIMEOUT_MS,
      });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        timeout: PDF_TIMEOUT_MS,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

```bash
npx nx build @org/api
```

Expected: build succeeds.

- [ ] **Step 3: Commit (ASK USER FIRST)**

Suggested message:
```
feat(api): add PdfRendererService (puppeteer wrapper)
```

---

## Task 5: TemplateFillerService + prompts

**Files:**
- Create: `apps/api/src/modules/consultant-cvs/cv-template-prompts.ts`
- Create: `apps/api/src/modules/consultant-cvs/template-filler.service.ts`

- [ ] **Step 1: Créer le module de prompts**

Créer `apps/api/src/modules/consultant-cvs/cv-template-prompts.ts` :

```ts
export const FILL_TEMPLATE_SYSTEM_PROMPT = `Tu es un assistant qui remplit un template HTML de CV à partir de données structurées.

Tu reçois deux blocs :
1. Un template HTML avec des placeholders ou des sections à compléter (ex : {{firstName}}, listes vides à remplir).
2. Un objet JSON contenant les données du CV.

Règles strictes :
- Tu renvoies UNIQUEMENT l'HTML final, sans markdown, sans backticks, sans commentaire avant ou après.
- Tu conserves rigoureusement la structure CSS et les classes du template.
- Si une donnée du JSON dépasse l'espace prévu (ex : description d'expérience trop longue), tu la résumes pour qu'elle tienne sans casser la mise en page.
- Si une donnée est absente, tu masques l'élément concerné (ex : tu ne laisses pas un libellé "Email :" sans valeur).
- Tu n'inventes jamais de contenu absent du JSON.

Réponds avec l'HTML complet, prêt à être rendu en PDF.`;

export function buildFillTemplatePrompt(
  cvData: unknown,
): string {
  return `Voici les données du CV (JSON) :

${JSON.stringify(cvData, null, 2)}

Remplis le template HTML ci-dessus avec ces données et retourne l'HTML final.`;
}
```

- [ ] **Step 2: Créer le service**

Créer `apps/api/src/modules/consultant-cvs/template-filler.service.ts` :

```ts
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type { CvData, CvTemplateValue } from '@org/schemas';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import {
  FILL_TEMPLATE_SYSTEM_PROMPT,
  buildFillTemplatePrompt,
} from './cv-template-prompts';

const TEMPLATE_FILES: Record<CvTemplateValue, string> = {
  tekteo: 'cv_template_tekteo.html',
  anonyme: 'cv_template_anonyme.html',
};

const TEMPLATES_DIR = resolve('apps/api/templates');

interface FillResult {
  html: string;
  modelUsed: string;
  tokensUsed: number;
}

/**
 * Remplit un template HTML de CV via Claude.
 * Utilise le prompt caching pour amortir le coût du template (statique).
 */
@Injectable()
export class TemplateFillerService {
  private readonly logger = new Logger(TemplateFillerService.name);
  private readonly templateCache = new Map<CvTemplateValue, string>();

  constructor(private readonly anthropic: AnthropicService) {}

  async fill(cvData: CvData, template: CvTemplateValue): Promise<FillResult> {
    const templateHtml = await this.getTemplate(template);

    // Le system prompt inclut le template HTML pour bénéficier du prompt caching
    // (le template change rarement, ses tokens sont mis en cache côté Anthropic).
    const systemWithTemplate = `${FILL_TEMPLATE_SYSTEM_PROMPT}

Voici le template HTML à utiliser :

${templateHtml}`;

    const generation = await this.anthropic.generate({
      systemPrompt: systemWithTemplate,
      userMessage: buildFillTemplatePrompt(cvData),
      maxTokens: 16_000,
    });

    const html = stripCodeFences(generation.content);
    if (!html.toLowerCase().includes('<html')) {
      throw new Error(
        'template_fill_failed: la réponse de Claude ne contient pas de HTML valide',
      );
    }

    return {
      html,
      modelUsed: generation.modelUsed,
      tokensUsed:
        generation.usage.inputTokens + generation.usage.outputTokens,
    };
  }

  private async getTemplate(template: CvTemplateValue): Promise<string> {
    const cached = this.templateCache.get(template);
    if (cached) return cached;
    const path = join(TEMPLATES_DIR, TEMPLATE_FILES[template]);
    const content = await readFile(path, 'utf-8');
    this.templateCache.set(template, content);
    this.logger.log(`📄 Template "${template}" chargé (${content.length} chars)`);
    return content;
  }
}

/**
 * Retire les éventuels fences markdown que Claude ajoute parfois
 * malgré l'instruction.
 */
function stripCodeFences(text: string): string {
  let trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:html)?\n/, '').replace(/```\s*$/, '');
  }
  return trimmed.trim();
}
```

- [ ] **Step 3: Vérifier la compilation**

```bash
npx nx build @org/api
```

Expected: build succeeds.

- [ ] **Step 4: Commit (ASK USER FIRST)**

Suggested message:
```
feat(api): add TemplateFillerService and CV template prompts
```

---

## Task 6: GeneratedCvService

**Files:**
- Create: `apps/api/src/modules/consultant-cvs/generated-cvs.service.ts`

- [ ] **Step 1: Implémenter le service**

Créer `apps/api/src/modules/consultant-cvs/generated-cvs.service.ts` :

```ts
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
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

const STORAGE_SCOPE_ROOT = 'cv';

@Injectable()
export class GeneratedCvsService {
  private readonly logger = new Logger(GeneratedCvsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: AbstractStorageService,
  ) {}

  /**
   * Crée une ligne `generated_cvs` en statut `pending`. Renvoyée tout de suite ;
   * le pipeline du processor passera ensuite la ligne en `processing` puis
   * `success`/`failed`.
   */
  createPending(
    consultantId: string,
    template: CvTemplateValue,
    userId: string,
  ) {
    return this.prisma.generatedCv.create({
      data: {
        consultantId,
        template,
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

  async markSuccess(
    id: string,
    storedFile: StoredFile,
    filename: string,
  ) {
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

  /**
   * Persiste le buffer PDF dans le storage et lie le fichier au generatedCv.
   */
  async storePdf(
    generatedCvId: string,
    consultantId: string,
    buffer: Buffer,
    filename: string,
  ): Promise<StoredFile> {
    return this.storage.save(
      join(STORAGE_SCOPE_ROOT, consultantId),
      `${generatedCvId}.pdf`,
      buffer,
    );
  }

  async findOne(id: string, consultantId: string) {
    const cv = await this.prisma.generatedCv.findFirst({
      where: { id, consultantId },
    });
    if (!cv) {
      throw new NotFoundException(`CV généré ${id} introuvable`);
    }
    return cv;
  }

  /**
   * Stream le PDF d'un CV généré pour téléchargement.
   * Refuse si le statut n'est pas `success`.
   */
  async getDownload(id: string, consultantId: string) {
    const cv = await this.findOne(id, consultantId);
    if (cv.status !== 'success' || !cv.outputPath) {
      throw new ConflictException(
        'Le CV n\'est pas encore généré ou a échoué',
      );
    }
    return {
      stream: this.storage.createReadStream(cv.outputPath),
      filename: cv.filename ?? `cv_${id}.pdf`,
    };
  }

  /**
   * Supprime un CV généré (ligne + fichier storage). Idempotent.
   */
  async remove(id: string, consultantId: string) {
    const cv = await this.findOne(id, consultantId);
    if (cv.outputPath) {
      try {
        await this.storage.remove(cv.outputPath);
      } catch (err) {
        this.logger.warn(
          `Suppression fichier ${cv.outputPath} échouée : ${err}`,
        );
      }
    }
    await this.prisma.generatedCv.delete({ where: { id } });
  }

  /**
   * Purge les fichiers PDF d'un consultant avant la suppression cascade.
   * À appeler depuis ConsultantCvsService.remove().
   */
  async purgeForConsultant(consultantId: string) {
    const cvs = await this.prisma.generatedCv.findMany({
      where: { consultantId, outputPath: { not: null } },
      select: { id: true, outputPath: true },
    });
    for (const cv of cvs) {
      if (!cv.outputPath) continue;
      try {
        await this.storage.remove(cv.outputPath);
      } catch (err) {
        this.logger.warn(
          `Purge fichier ${cv.outputPath} échouée : ${err}`,
        );
      }
    }
  }
}
```

- [ ] **Step 2: Compiler**

```bash
npx nx build @org/api
```

Expected: build succeeds.

- [ ] **Step 3: Commit (ASK USER FIRST)**

Suggested message:
```
feat(api): add GeneratedCvsService (CRUD + storage)
```

---

## Task 7: Évolution de `CvImportService` (multi-fichier + kind generate)

**Files:**
- Modify: `apps/api/src/modules/consultant-cvs/cv-import.service.ts`

- [ ] **Step 1: Remplacer le contenu du fichier**

Réécrire `apps/api/src/modules/consultant-cvs/cv-import.service.ts` :

```ts
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { CvTemplateValue } from '@org/schemas';
import { CV_IMPORT_QUEUE } from '../../common/queue/queue.module';
import { PrismaService } from '../../common/prisma/prisma.service';

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10;

interface FileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface CvImportJobPayload {
  jobId: string;
  kind: 'import' | 'generate';
  inputPath?: string;        // requis si kind=import
  consultantId?: string;     // requis si kind=generate
  template: CvTemplateValue;
}

@Injectable()
export class CvImportService {
  private readonly uploadsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(CV_IMPORT_QUEUE)
    private readonly queue: Queue<CvImportJobPayload>,
  ) {
    this.uploadsDir = resolve(
      this.config.get<string>('UPLOADS_DIR', 'apps/api/uploads'),
    );
  }

  /**
   * Crée N jobs d'import (un par fichier) en parallèle.
   * Chaque fichier devient un profil consultant + un CV généré.
   */
  async createBulkImports(
    userId: string,
    files: FileLike[],
    template: CvTemplateValue,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      throw new BadRequestException(
        `Maximum ${MAX_FILES_PER_REQUEST} fichiers par import`,
      );
    }
    files.forEach((f) => this.validateFile(f));

    const jobs = await Promise.all(
      files.map((file) => this.createSingleImport(userId, file, template)),
    );
    return { jobs };
  }

  /**
   * Crée un job de génération (depuis la page détail) — pas de fichier en input.
   */
  async createGenerationJob(
    userId: string,
    consultantId: string,
    template: CvTemplateValue,
  ) {
    const consultant = await this.prisma.consultantCv.findUnique({
      where: { id: consultantId },
      select: { id: true },
    });
    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} introuvable`);
    }

    const job = await this.prisma.cvImportJob.create({
      data: {
        userId,
        kind: 'generate',
        template,
        consultantId,
        status: 'pending',
      },
    });

    await this.queue.add(
      CV_IMPORT_QUEUE,
      { jobId: job.id, kind: 'generate', consultantId, template },
      { removeOnComplete: { age: 86_400 }, removeOnFail: { age: 86_400 } },
    );

    return { jobId: job.id, status: job.status };
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.cvImportJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.userId !== userId) {
      throw new NotFoundException(`Import ${jobId} introuvable`);
    }
    return {
      jobId: job.id,
      kind: job.kind,
      status: job.status,
      template: job.template,
      consultantId: job.consultantId,
      generatedCvId: job.generatedCvId,
      inputFilename: job.inputFilename,
      error: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------

  private async createSingleImport(
    userId: string,
    file: FileLike,
    template: CvTemplateValue,
  ) {
    const ext = file.mimetype === 'application/pdf' ? 'pdf' : 'docx';
    const uuid = randomUUID();
    const importsDir = join(this.uploadsDir, 'cv-imports');
    await mkdir(importsDir, { recursive: true });
    const inputPath = join(importsDir, `${uuid}.${ext}`);
    await writeFile(inputPath, file.buffer);

    const job = await this.prisma.cvImportJob.create({
      data: {
        userId,
        kind: 'import',
        template,
        inputPath,
        inputFilename: file.originalname,
        status: 'pending',
      },
    });

    await this.queue.add(
      CV_IMPORT_QUEUE,
      { jobId: job.id, kind: 'import', inputPath, template },
      { removeOnComplete: { age: 86_400 }, removeOnFail: { age: 86_400 } },
    );

    return { jobId: job.id, status: job.status };
  }

  private validateFile(file: FileLike): void {
    if (!file) {
      throw new BadRequestException('Fichier manquant');
    }
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Format non supporté pour ${file.originalname} : seuls PDF et DOCX sont acceptés`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `Fichier ${file.originalname} trop volumineux (10 Mo max)`,
      );
    }
  }
}
```

- [ ] **Step 2: Compiler**

```bash
npx nx build @org/api
```

Expected: build succeeds. Si erreurs côté processor, c'est attendu — sera fixé en Task 8.

- [ ] **Step 3: Commit (ASK USER FIRST)**

Suggested message:
```
feat(api): support multi-file import and generate-kind jobs in CvImportService
```

---

## Task 8: Évolution de `CvImportProcessor` (pipeline complet)

**Files:**
- Modify: `apps/api/src/modules/consultant-cvs/cv-import.processor.ts`

- [ ] **Step 1: Réécrire le processor**

Réécrire `apps/api/src/modules/consultant-cvs/cv-import.processor.ts` :

```ts
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import mammoth from 'mammoth';
import { Prisma } from '../../generated/prisma/client';
import type { CvData, CvTemplateValue } from '@org/schemas';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CV_IMPORT_QUEUE } from '../../common/queue/queue.module';
import { parseLlmJson } from '../../common/utils/llm-json.util';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import { CvImportEventService } from './cv-import-event.service';
import type { CvImportJobPayload } from './cv-import.service';
import { GeneratedCvsService } from './generated-cvs.service';
import { PdfRendererService } from './pdf-renderer.service';
import { TemplateFillerService } from './template-filler.service';
import {
  FORMAT_SYSTEM_PROMPT,
  buildFormatPrompt,
} from './cv-prompts';

@Processor(CV_IMPORT_QUEUE)
export class CvImportProcessor extends WorkerHost {
  private readonly logger = new Logger(CvImportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly history: GenerationHistoryService,
    private readonly events: CvImportEventService,
    private readonly templateFiller: TemplateFillerService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly generatedCvs: GeneratedCvsService,
  ) {
    super();
  }

  async process(job: Job<CvImportJobPayload>): Promise<void> {
    const { jobId, kind } = job.data;
    this.logger.log(`Processing CV ${kind} ${jobId}`);

    const importJob = await this.prisma.cvImportJob.findUnique({
      where: { id: jobId },
    });
    if (!importJob) {
      this.logger.warn(`CvImportJob ${jobId} introuvable, on ignore`);
      return;
    }

    await this.markStatus(jobId, 'processing');

    try {
      if (kind === 'import') {
        await this.runImportPipeline(importJob);
      } else {
        await this.runGeneratePipeline(importJob);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Job ${jobId} failed: ${message}`);
      await this.prisma.cvImportJob.update({
        where: { id: jobId },
        data: { status: 'failed', errorMessage: message.slice(0, 2000) },
      });
      this.events.emit(jobId, {
        status: 'failed',
        error: message.slice(0, 2000),
      });
      throw err;
    }
  }

  // -----------------------------------------------------------
  // Pipeline IMPORT (upload fichier)
  // -----------------------------------------------------------

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

    // 1. Extraction texte + structuration (Claude)
    const generation = await this.extract(importJob.inputPath);
    const cvData = parseLlmJson<CvData>(generation.content);
    const tokensUsed =
      generation.usage.inputTokens + generation.usage.outputTokens;

    // 2. Création du profil consultant
    const consultant = await this.prisma.consultantCv.create({
      data: {
        cvData: cvData as unknown as Prisma.InputJsonValue,
        consultantName: extractIdentityName(cvData),
        consultantTitle: extractIdentityRole(cvData),
        createdById: importJob.userId,
      },
    });

    // Lier le consultant au job + émettre SSE
    await this.prisma.cvImportJob.update({
      where: { id: importJob.id },
      data: { consultantId: consultant.id },
    });
    this.events.emit(importJob.id, {
      status: 'processing',
      consultantId: consultant.id,
    });

    // 3. Historique génération
    await this.history.record({
      module: 'cv',
      userId: importJob.userId,
      modelUsed: generation.modelUsed,
      tokensUsed,
      outputContent: `Import depuis ${importJob.inputFilename ?? '(inconnu)'} → consultant ${consultant.id}`,
      inputData: {
        mode: 'import-from-file',
        template: importJob.template,
        inputFilename: importJob.inputFilename,
      },
    });

    // 4. Pipeline de génération (template → Claude → Puppeteer → storage)
    await this.runGenerationSteps(
      importJob.id,
      importJob.userId,
      consultant.id,
      consultant.consultantName,
      cvData,
      importJob.template,
    );
  }

  // -----------------------------------------------------------
  // Pipeline GENERATE (depuis page détail)
  // -----------------------------------------------------------

  private async runGeneratePipeline(importJob: {
    id: string;
    userId: string;
    consultantId: string | null;
    template: CvTemplateValue;
  }): Promise<void> {
    if (!importJob.consultantId) {
      throw new Error('generate_failed: consultantId manquant pour un job generate');
    }

    const consultant = await this.prisma.consultantCv.findUnique({
      where: { id: importJob.consultantId },
    });
    if (!consultant) {
      throw new Error(`generate_failed: consultant ${importJob.consultantId} introuvable`);
    }

    await this.runGenerationSteps(
      importJob.id,
      importJob.userId,
      consultant.id,
      consultant.consultantName,
      consultant.cvData as unknown as CvData,
      importJob.template,
    );
  }

  // -----------------------------------------------------------
  // Étapes de génération communes (fill template + render PDF + store)
  // -----------------------------------------------------------

  private async runGenerationSteps(
    jobId: string,
    userId: string,
    consultantId: string,
    consultantName: string | null,
    cvData: CvData,
    template: CvTemplateValue,
  ): Promise<void> {
    // Créer la ligne generated_cvs en pending
    const generatedCv = await this.generatedCvs.createPending(
      consultantId,
      template,
      userId,
    );

    // Lier au job + émettre SSE
    await this.prisma.cvImportJob.update({
      where: { id: jobId },
      data: { generatedCvId: generatedCv.id },
    });
    this.events.emit(jobId, {
      status: 'processing',
      generatedCvId: generatedCv.id,
    });

    try {
      await this.generatedCvs.markProcessing(generatedCv.id);

      // 1. Claude remplit le template
      let filled;
      try {
        filled = await this.templateFiller.fill(cvData, template);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`template_fill_failed: ${msg}`);
      }

      // 2. Puppeteer rend le PDF
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await this.pdfRenderer.render(filled.html);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`pdf_render_failed: ${msg}`);
      }

      // 3. Stockage
      const filename = buildFilename(consultantName, template);
      let stored;
      try {
        stored = await this.generatedCvs.storePdf(
          generatedCv.id,
          consultantId,
          pdfBuffer,
          filename,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`storage_write_failed: ${msg}`);
      }

      // 4. Marquer success + finaliser le job
      await this.generatedCvs.markSuccess(generatedCv.id, stored, filename);
      await this.markStatus(jobId, 'done');
      this.events.emit(jobId, {
        status: 'done',
        consultantId,
        generatedCvId: generatedCv.id,
      });

      // 5. Historique IA (consommation Claude pour le fill)
      await this.history.record({
        module: 'cv',
        userId,
        modelUsed: filled.modelUsed,
        tokensUsed: filled.tokensUsed,
        outputContent: `Génération PDF ${template} pour consultant ${consultantId}`,
        inputData: { mode: 'fill-template', template, generatedCvId: generatedCv.id },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.generatedCvs.markFailed(generatedCv.id, message);
      throw err;
    }
  }

  private async markStatus(
    jobId: string,
    status: 'processing' | 'done' | 'failed',
  ) {
    await this.prisma.cvImportJob.update({
      where: { id: jobId },
      data: { status },
    });
    this.events.emit(jobId, { status });
  }

  private async extract(inputPath: string) {
    const ext = extname(inputPath).toLowerCase();
    const buffer = await readFile(inputPath);

    if (ext === '.pdf') {
      return this.anthropic.generate({
        systemPrompt: FORMAT_SYSTEM_PROMPT,
        userMessage: buildFormatPrompt(
          'Le contenu du CV est joint en pièce jointe (PDF). Analyse-le et extrais les données.',
        ),
        maxTokens: 8192,
        attachments: [
          {
            name: 'cv.pdf',
            mediaType: 'application/pdf',
            data: buffer.toString('base64'),
          },
        ],
      });
    }

    if (ext === '.docx') {
      const { value } = await mammoth.extractRawText({ buffer });
      const text = value.trim();
      if (!text) {
        throw new Error('extraction_failed: DOCX vide ou illisible');
      }
      return this.anthropic.generate({
        systemPrompt: FORMAT_SYSTEM_PROMPT,
        userMessage: buildFormatPrompt(text),
        maxTokens: 8192,
      });
    }

    throw new Error(`extraction_failed: format non supporté ${ext}`);
  }
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

function extractIdentityName(cvData: CvData): string | null {
  const identity = (cvData.identity ?? {}) as Record<string, unknown>;
  const parts = (['firstName', 'lastName'] as const)
    .map((k) => identity[k])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return parts.length > 0 ? parts.join(' ') : null;
}

function extractIdentityRole(cvData: CvData): string | null {
  const identity = (cvData.identity ?? {}) as Record<string, unknown>;
  const role = identity['role'];
  return typeof role === 'string' && role.trim().length > 0 ? role : null;
}

function buildFilename(name: string | null, template: string): string {
  const slug = (name ?? 'consultant')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    || 'consultant';
  return `${slug}_${template}.pdf`;
}
```

- [ ] **Step 2: Compiler**

```bash
npx nx build @org/api
```

Expected: build succeeds.

- [ ] **Step 3: Commit (ASK USER FIRST)**

Suggested message:
```
feat(api): extend CvImportProcessor with template fill + PDF render pipeline
```

---

## Task 9: Évolution de `ConsultantCvsService`

**Files:**
- Modify: `apps/api/src/modules/consultant-cvs/consultant-cvs.service.ts`

- [ ] **Step 1: Étendre `findAll` avec pagination + `latestGeneratedCv`**

Repérer la méthode `findAll()` (ligne ~33) et la **remplacer** par :

```ts
findAll(params: { page: number; pageSize: number }) {
  return this.findPaginated(params);
}

private async findPaginated({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    this.prisma.consultantCv.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        _count: { select: { jobProfiles: true } },
        generatedCvs: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            template: true,
            status: true,
            updatedAt: true,
          },
        },
      },
    }),
    this.prisma.consultantCv.count(),
  ]);

  return {
    items: items.map((c) => ({
      ...c,
      latestGeneratedCv: c.generatedCvs[0] ?? null,
      generatedCvs: undefined,
    })),
    total,
    page,
    pageSize,
  };
}
```

- [ ] **Step 2: Étendre `findOne` avec la liste des CVs générés**

Remplacer la méthode `findOne(id)` (ligne ~43) par :

```ts
async findOne(id: string) {
  const cv = await this.prisma.consultantCv.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, email: true, fullName: true } },
      jobProfiles: { select: { id: true, title: true, projectId: true } },
      generatedCvs: {
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          template: true,
          status: true,
          filename: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!cv) throw new NotFoundException(`Consultant ${id} introuvable`);
  return cv;
}
```

- [ ] **Step 3: Adapter `create` à la nouvelle validation Zod stricte**

La méthode `create` (ligne ~57) est compatible — `consultantName` et `consultantTitle` sont déjà passés. Mais le typage sera maintenant `string` (non-optionnel) côté Zod. Pas de changement de code, juste vérifier la cohérence avec le DTO.

- [ ] **Step 4: Adapter `remove` pour purger les fichiers PDF avant cascade**

Injecter `GeneratedCvsService` dans le constructeur :

```ts
import { GeneratedCvsService } from './generated-cvs.service';

@Injectable()
export class ConsultantCvsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly history: GenerationHistoryService,
    private readonly generatedCvs: GeneratedCvsService,  // ← ajout
  ) {}
```

Et remplacer `remove(id)` (ligne ~86) par :

```ts
async remove(id: string) {
  await this.findOne(id);
  // Purge des fichiers PDF avant cascade Prisma
  await this.generatedCvs.purgeForConsultant(id);
  return this.prisma.consultantCv.delete({ where: { id } });
}
```

- [ ] **Step 5: Compiler**

```bash
npx nx build @org/api
```

Expected: build succeeds. Si erreurs sur le contrôleur, c'est attendu — sera fixé en Task 10.

- [ ] **Step 6: Commit (ASK USER FIRST)**

Suggested message:
```
feat(api): paginate ConsultantCvsService.findAll and include generatedCvs
```

---

## Task 10: Évolution du contrôleur (nouveaux endpoints + pagination + multi-fichier)

**Files:**
- Modify: `apps/api/src/modules/consultant-cvs/consultant-cvs.controller.ts`

- [ ] **Step 1: Réécrire le contrôleur**

Réécrire `apps/api/src/modules/consultant-cvs/consultant-cvs.controller.ts` :

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
  Res,
  Sse,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { concat, map, Observable, of } from 'rxjs';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  adaptCvToJobSchema,
  consultantCvsListQuerySchema,
  createConsultantCvSchema,
  cvTemplateSchema,
  formatCvFromTextSchema,
  generateCvFromTemplateSchema,
  updateConsultantCvSchema,
  type AdaptCvToJobDto,
  type ConsultantCvsListQueryDto,
  type CreateConsultantCvDto,
  type CvTemplateValue,
  type FormatCvFromTextDto,
  type GenerateCvFromTemplateDto,
  type UpdateConsultantCvDto,
} from '@org/schemas';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth.types';
import { ConsultantCvsService } from './consultant-cvs.service';
import { CvImportEventService } from './cv-import-event.service';
import { CvImportService } from './cv-import.service';
import { GeneratedCvsService } from './generated-cvs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consultant-cvs')
export class ConsultantCvsController {
  constructor(
    private readonly cvs: ConsultantCvsService,
    private readonly imports: CvImportService,
    private readonly importEvents: CvImportEventService,
    private readonly generatedCvs: GeneratedCvsService,
  ) {}

  // -----------------------------------------------------------
  // Profils consultants
  // -----------------------------------------------------------

  @Get()
  findAll(
    @Query(new ZodValidationPipe(consultantCvsListQuerySchema))
    query: ConsultantCvsListQueryDto,
  ) {
    return this.cvs.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cvs.findOne(id);
  }

  @Post()
  @Roles(['admin', 'redacteur'])
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createConsultantCvSchema))
    dto: CreateConsultantCvDto,
  ) {
    return this.cvs.create(user.id, dto);
  }

  @Patch(':id')
  @Roles(['admin', 'redacteur'])
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateConsultantCvSchema))
    dto: UpdateConsultantCvDto,
  ) {
    return this.cvs.update(id, dto);
  }

  @Delete(':id')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.cvs.remove(id);
  }

  // -----------------------------------------------------------
  // Extraction depuis texte (legacy — conservé pour compat API)
  // -----------------------------------------------------------

  @Post('format-from-text')
  @Roles(['admin', 'redacteur'])
  @HttpCode(200)
  formatFromText(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(formatCvFromTextSchema))
    dto: FormatCvFromTextDto,
  ) {
    return this.cvs.formatFromText(user.id, dto);
  }

  @Post(':id/adapt-to-job')
  @Roles(['admin', 'redacteur'])
  @HttpCode(200)
  adaptToJob(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(adaptCvToJobSchema)) dto: AdaptCvToJobDto,
  ) {
    return this.cvs.adaptToJob(id, user.id, dto);
  }

  // -----------------------------------------------------------
  // Import multi-fichier (PDF/DOCX → consultant + CV)
  // -----------------------------------------------------------

  @Post('import-from-file')
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
          generatedCvId: job.generatedCvId,
          error: job.error,
        }),
      );
    }

    return concat(
      of(toEvent({ kind: job.kind, status: job.status, template: job.template })),
      this.importEvents.watch(jobId).pipe(map(toEvent)),
    );
  }

  // -----------------------------------------------------------
  // Génération depuis page détail
  // -----------------------------------------------------------

  @Post(':id/generate')
  @Roles(['admin', 'redacteur'])
  generate(
    @Param('id') consultantId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(generateCvFromTemplateSchema))
    dto: GenerateCvFromTemplateDto,
  ) {
    return this.imports.createGenerationJob(
      user.id,
      consultantId,
      dto.template,
    );
  }

  // -----------------------------------------------------------
  // CVs générés — download / delete
  // -----------------------------------------------------------

  @Get(':id/generated-cvs/:genId/download')
  async downloadGeneratedCv(
    @Param('id') consultantId: string,
    @Param('genId') genId: string,
    @Res() res: Response,
  ) {
    const { stream, filename } = await this.generatedCvs.getDownload(
      genId,
      consultantId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    stream.pipe(res);
  }

  @Delete(':id/generated-cvs/:genId')
  @Roles(['admin', 'redacteur'])
  @HttpCode(204)
  async removeGeneratedCv(
    @Param('id') consultantId: string,
    @Param('genId') genId: string,
  ) {
    await this.generatedCvs.remove(genId, consultantId);
  }
}
```

- [ ] **Step 2: Compiler**

```bash
npx nx build @org/api
```

Expected: build succeeds. Si erreur de wiring (provider manquant), c'est attendu — sera fixé en Task 11.

- [ ] **Step 3: Commit (ASK USER FIRST)**

Suggested message:
```
feat(api): expose new consultant-cv endpoints (multi-import, generate, download, delete generated)
```

---

## Task 11: Wiring du module

**Files:**
- Modify: `apps/api/src/modules/consultant-cvs/consultant-cvs.module.ts`

- [ ] **Step 1: Ajouter les nouveaux providers**

Réécrire `apps/api/src/modules/consultant-cvs/consultant-cvs.module.ts` :

```ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { CV_IMPORT_QUEUE, QueueModule } from '../../common/queue/queue.module';
import { StorageModule } from '../../common/storage/storage.module';
import { ConsultantCvsController } from './consultant-cvs.controller';
import { ConsultantCvsService } from './consultant-cvs.service';
import { CvImportEventService } from './cv-import-event.service';
import { CvImportProcessor } from './cv-import.processor';
import { CvImportService } from './cv-import.service';
import { GeneratedCvsService } from './generated-cvs.service';
import { PdfRendererService } from './pdf-renderer.service';
import { TemplateFillerService } from './template-filler.service';

@Module({
  imports: [
    AuthModule,
    QueueModule,
    StorageModule,
    BullModule.registerQueue({ name: CV_IMPORT_QUEUE }),
  ],
  controllers: [ConsultantCvsController],
  providers: [
    ConsultantCvsService,
    CvImportService,
    CvImportProcessor,
    CvImportEventService,
    GeneratedCvsService,
    PdfRendererService,
    TemplateFillerService,
  ],
  exports: [ConsultantCvsService, GeneratedCvsService],
})
export class ConsultantCvsModule {}
```

- [ ] **Step 2: Compiler & lancer un smoke test API**

```bash
npx nx build @org/api
```

Expected: build succeeds.

```bash
npx nx serve api
```

Dans un autre terminal :

```bash
curl -i http://localhost:3000/api/consultant-cvs?page=1&pageSize=5
```

Expected: `401 Unauthorized` (sans JWT) — confirme la route enregistrée et le guard actif.

- [ ] **Step 3: Commit (ASK USER FIRST)**

Suggested message:
```
feat(api): wire GeneratedCvsService, PdfRendererService, TemplateFillerService into ConsultantCvsModule
```

---

# PHASE 3 — Frontend

## Task 12: Front service + types

**Files:**
- Modify: `apps/front/src/app/core/consultant-cvs/consultant-cv.model.ts`
- Modify: `apps/front/src/app/core/consultant-cvs/consultant-cvs.service.ts`

- [ ] **Step 1: Étendre les types**

Réécrire `apps/front/src/app/core/consultant-cvs/consultant-cv.model.ts` :

```ts
import type {
  CvData,
  CvJobEventDto,
  GeneratedCvDto,
  CvTemplateValue,
  CvGenerationStatusValue,
} from '@org/schemas';

export type {
  CvData,
  CvJobEventDto,
  GeneratedCvDto,
  CvTemplateValue,
  CvGenerationStatusValue,
};
export type {
  CreateConsultantCvDto,
  UpdateConsultantCvDto,
  FormatCvFromTextDto,
  AdaptCvToJobDto,
  CvImportStatusValue,
  GenerateCvFromTemplateDto,
} from '@org/schemas';

export interface CvIdentity {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly role?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly location?: string;
  readonly summary?: string;
  readonly [key: string]: unknown;
}

/** Métadonnées du dernier CV généré (utilisé dans la liste). */
export interface LatestGeneratedCv {
  readonly id: string;
  readonly template: CvTemplateValue;
  readonly status: CvGenerationStatusValue;
  readonly updatedAt: string;
}

/** Profil consultant tel que renvoyé par l'API. */
export interface ConsultantCv {
  readonly id: string;
  readonly cvData: CvData;
  readonly consultantName: string | null;
  readonly consultantTitle: string | null;
  readonly createdById: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy?: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  readonly _count?: { jobProfiles: number };
  readonly jobProfiles?: ReadonlyArray<{
    id: string;
    title: string;
    projectId: string | null;
  }>;
  readonly latestGeneratedCv?: LatestGeneratedCv | null;
  readonly generatedCvs?: ReadonlyArray<GeneratedCvDto>;
}

/** Page paginée de la liste consultants. */
export interface ConsultantCvsPage {
  readonly items: ConsultantCv[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Réponse de POST /import-from-file (multi). */
export interface CvImportBulkResponse {
  readonly jobs: ReadonlyArray<{
    jobId: string;
    status: 'pending' | 'processing' | 'done' | 'failed';
  }>;
}

/** Réponse de POST /:id/generate. */
export interface CvGenerationResponse {
  readonly jobId: string;
  readonly status: 'pending' | 'processing' | 'done' | 'failed';
}
```

- [ ] **Step 2: Étendre le service HTTP**

Réécrire `apps/front/src/app/core/consultant-cvs/consultant-cvs.service.ts` :

```ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdaptCvToJobDto,
  ConsultantCv,
  ConsultantCvsPage,
  CreateConsultantCvDto,
  CvGenerationResponse,
  CvImportBulkResponse,
  CvJobEventDto,
  CvTemplateValue,
  FormatCvFromTextDto,
  type GeneratedCvDto,
  UpdateConsultantCvDto,
} from './consultant-cv.model';
import type { FormatCvResponse } from './consultant-cv.model';

const API = '/api/consultant-cvs';

@Injectable({ providedIn: 'root' })
export class ConsultantCvsService {
  private readonly http = inject(HttpClient);

  list(params: { page: number; pageSize: number }): Observable<ConsultantCvsPage> {
    const httpParams = new HttpParams()
      .set('page', params.page)
      .set('pageSize', params.pageSize);
    return this.http.get<ConsultantCvsPage>(API, { params: httpParams });
  }

  get(id: string): Observable<ConsultantCv> {
    return this.http.get<ConsultantCv>(`${API}/${id}`);
  }

  create(dto: CreateConsultantCvDto): Observable<ConsultantCv> {
    return this.http.post<ConsultantCv>(API, dto);
  }

  update(id: string, dto: UpdateConsultantCvDto): Observable<ConsultantCv> {
    return this.http.patch<ConsultantCv>(`${API}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/${id}`);
  }

  formatFromText(dto: FormatCvFromTextDto): Observable<FormatCvResponse> {
    return this.http.post<FormatCvResponse>(`${API}/format-from-text`, dto);
  }

  adaptToJob(id: string, dto: AdaptCvToJobDto): Observable<FormatCvResponse> {
    return this.http.post<FormatCvResponse>(`${API}/${id}/adapt-to-job`, dto);
  }

  // -----------------------------------------------------------
  // Import multi-fichier
  // -----------------------------------------------------------

  importMultipleFiles(
    files: File[],
    template: CvTemplateValue,
  ): Observable<CvImportBulkResponse> {
    const form = new FormData();
    for (const file of files) {
      form.append('files', file);
    }
    form.append('template', template);
    return this.http.post<CvImportBulkResponse>(
      `${API}/import-from-file`,
      form,
    );
  }

  watchImportJob(jobId: string): Observable<Partial<CvJobEventDto>> {
    return new Observable((observer) => {
      const source = new EventSource(
        `${API}/import-jobs/${jobId}/events`,
        { withCredentials: true },
      );
      source.onmessage = (event) => {
        const data = JSON.parse(event.data) as Partial<CvJobEventDto>;
        observer.next(data);
        if (data.status === 'done' || data.status === 'failed') {
          source.close();
          observer.complete();
        }
      };
      source.onerror = () => {
        source.close();
        observer.error(new Error('Connexion SSE perdue'));
      };
      return () => source.close();
    });
  }

  // -----------------------------------------------------------
  // Génération depuis détail
  // -----------------------------------------------------------

  generate(
    consultantId: string,
    template: CvTemplateValue,
  ): Observable<CvGenerationResponse> {
    return this.http.post<CvGenerationResponse>(
      `${API}/${consultantId}/generate`,
      { template },
    );
  }

  // -----------------------------------------------------------
  // CVs générés — download / delete
  // -----------------------------------------------------------

  /** URL absolue pour ouvrir le PDF dans un nouvel onglet ou déclencher download. */
  buildDownloadUrl(consultantId: string, genId: string): string {
    return `${API}/${consultantId}/generated-cvs/${genId}/download`;
  }

  removeGeneratedCv(
    consultantId: string,
    genId: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${API}/${consultantId}/generated-cvs/${genId}`,
    );
  }
}
```

- [ ] **Step 3: Build + tests TypeScript**

```bash
npx nx build front
```

Expected: build casse uniquement sur `cv-formatter.page.ts` qui utilise les anciennes méthodes — fixé en Task 17. Pour valider que le service compile en isolation :

```bash
npx tsc --noEmit -p apps/front/tsconfig.json 2>&1 | grep "consultant-cvs.service"
```

Expected: pas d'erreur sur ce fichier.

- [ ] **Step 4: Commit (ASK USER FIRST)**

Suggested message:
```
feat(front): extend ConsultantCvsService for pagination, multi-import, generation, download, delete generated
```

---

## Task 13: Composant `GenerateCvDialog`

**Files:**
- Create: `apps/front/src/app/pages/cv-formatter/generate-cv-dialog.ts`

- [ ] **Step 1: Implémenter le composant**

Créer `apps/front/src/app/pages/cv-formatter/generate-cv-dialog.ts` :

```ts
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import type { CvTemplateValue } from '../../core/consultant-cvs/consultant-cv.model';
import { ModalShell } from '../../shared/ui/modal-shell/modal-shell';
import { Button } from '../../shared/ui/button/button';

const TEMPLATE_OPTIONS: ReadonlyArray<{
  value: CvTemplateValue;
  label: string;
  description: string;
}> = [
  {
    value: 'tekteo',
    label: 'Tekteo',
    description: 'Mise en page complète avec identité Tekteo.',
  },
  {
    value: 'anonyme',
    label: 'Anonyme',
    description: 'CV anonymisé pour transmission externe.',
  },
];

/**
 * Mini-modal de choix de template pour la génération d'un CV.
 *
 * Renvoie le `CvTemplateValue` choisi en `closed` (ou `null` si annulé).
 */
@Component({
  selector: 'app-generate-cv-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShell, Button],
  template: `
    <app-modal-shell title="Générer un nouveau CV" (closeRequest)="cancel()">
      <p class="text-sm text-surface-900/60 mb-4">
        Choisissez le template à utiliser pour la génération.
      </p>
      <div class="space-y-2">
        @for (option of templates; track option.value) {
          <label
            class="flex items-start gap-3 rounded-xl border border-surface-200 p-3 cursor-pointer transition hover:border-brand-300"
            [class.border-brand-500]="selected() === option.value"
            [class.bg-brand-50]="selected() === option.value"
          >
            <input
              type="radio"
              name="template"
              [value]="option.value"
              [checked]="selected() === option.value"
              (change)="selected.set(option.value)"
              class="mt-0.5"
            />
            <div>
              <p class="text-sm font-semibold text-surface-900">
                {{ option.label }}
              </p>
              <p class="text-xs text-surface-900/60">
                {{ option.description }}
              </p>
            </div>
          </label>
        }
      </div>

      <div class="mt-6 flex items-center justify-end gap-2">
        <app-button variant="ghost" (click)="cancel()">Annuler</app-button>
        <app-button variant="primary" (click)="confirm()">
          Générer
        </app-button>
      </div>
    </app-modal-shell>
  `,
})
export class GenerateCvDialog {
  private readonly ref = inject<DialogRef<CvTemplateValue | null>>(DialogRef);

  protected readonly templates = TEMPLATE_OPTIONS;
  protected readonly selected = signal<CvTemplateValue>('tekteo');

  protected confirm(): void {
    this.ref.close(this.selected());
  }

  protected cancel(): void {
    this.ref.close(null);
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

```bash
npx nx build front
```

Expected: build casse encore sur les autres pages — c'est attendu. Le composant lui-même doit compiler.

- [ ] **Step 3: Commit (ASK USER FIRST)**

Suggested message:
```
feat(front): add GenerateCvDialog mini-modal for template choice
```

---

## Task 14: Composant `GeneratedCvList`

**Files:**
- Create: `apps/front/src/app/pages/cv-formatter/generated-cv-list.ts`
- Create: `apps/front/src/app/pages/cv-formatter/generated-cv-list.html`

- [ ] **Step 1: Implémenter le composant**

Créer `apps/front/src/app/pages/cv-formatter/generated-cv-list.ts` :

```ts
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import type {
  CvGenerationStatusValue,
  CvTemplateValue,
  GeneratedCvDto,
} from '../../core/consultant-cvs/consultant-cv.model';

interface StatusBadge {
  readonly label: string;
  readonly color: string;
  readonly bg: string;
}

const STATUS_BADGES: Record<CvGenerationStatusValue, StatusBadge> = {
  pending: { label: 'En attente', color: '#92400E', bg: '#FEF3C7' },
  processing: { label: 'En cours', color: '#92400E', bg: '#FEF3C7' },
  success: { label: 'Généré', color: '#065F46', bg: '#D1FAE5' },
  failed: { label: 'Échec', color: '#991B1B', bg: '#FEE2E2' },
};

const TEMPLATE_LABELS: Record<CvTemplateValue, string> = {
  tekteo: 'Tekteo',
  anonyme: 'Anonyme',
};

@Component({
  selector: 'app-generated-cv-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './generated-cv-list.html',
})
export class GeneratedCvList {
  readonly cvs = input.required<ReadonlyArray<GeneratedCvDto>>();
  readonly canEdit = input(false);

  readonly download = output<GeneratedCvDto>();
  readonly regenerate = output<GeneratedCvDto>();
  readonly remove = output<GeneratedCvDto>();

  protected statusBadge(status: CvGenerationStatusValue): StatusBadge {
    return STATUS_BADGES[status];
  }

  protected templateLabel(template: CvTemplateValue): string {
    return TEMPLATE_LABELS[template];
  }
}
```

- [ ] **Step 2: Implémenter le template**

Créer `apps/front/src/app/pages/cv-formatter/generated-cv-list.html` :

```html
@if (cvs().length === 0) {
  <div class="rounded-xl border border-dashed border-surface-200 bg-surface-50/60 px-4 py-8 text-center">
    <p class="text-sm text-surface-900/60">Aucun CV généré pour ce profil.</p>
  </div>
} @else {
  <ul class="space-y-2">
    @for (cv of cvs(); track cv.id) {
      <li class="flex items-center gap-4 rounded-xl border border-surface-200/70 bg-white px-4 py-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-surface-900">
              {{ templateLabel(cv.template) }}
            </span>
            <span
              class="px-2 py-0.5 rounded-full text-xs font-medium"
              [style.background-color]="statusBadge(cv.status).bg"
              [style.color]="statusBadge(cv.status).color"
            >
              {{ statusBadge(cv.status).label }}
            </span>
          </div>
          <p class="text-xs text-surface-900/40 mt-0.5">
            {{ cv.createdAt | date: 'dd MMM y, HH:mm' }}
          </p>
          @if (cv.status === 'failed' && cv.errorMessage) {
            <p class="text-xs text-red-700 mt-1">{{ cv.errorMessage }}</p>
          }
        </div>

        <div class="flex items-center gap-1">
          @if (cv.status === 'success') {
            <button
              type="button"
              class="rounded-lg p-2 text-surface-900/50 hover:bg-brand-50 hover:text-brand-700 transition"
              aria-label="Télécharger le CV"
              (click)="download.emit(cv)"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
            </button>
          }
          @if (cv.status === 'failed' && canEdit()) {
            <button
              type="button"
              class="rounded-lg p-2 text-surface-900/50 hover:bg-amber-50 hover:text-amber-700 transition"
              aria-label="Régénérer le CV"
              (click)="regenerate.emit(cv)"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014.7-3.5M19 5a9 9 0 00-14.7 3.5" />
              </svg>
            </button>
          }
          @if (canEdit()) {
            <button
              type="button"
              class="rounded-lg p-2 text-surface-900/40 hover:bg-red-50 hover:text-red-600 transition"
              aria-label="Supprimer le CV"
              (click)="remove.emit(cv)"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5 4v6m4-6v6M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M4 7h16" />
              </svg>
            </button>
          }
        </div>
      </li>
    }
  </ul>
}
```

- [ ] **Step 2: Commit (ASK USER FIRST)**

Suggested message:
```
feat(front): add GeneratedCvList component
```

---

## Task 15: Composant `MultiFileImportZone`

**Files:**
- Create: `apps/front/src/app/pages/cv-formatter/multi-file-import-zone.ts`
- Create: `apps/front/src/app/pages/cv-formatter/multi-file-import-zone.html`

- [ ] **Step 1: Implémenter le composant**

Créer `apps/front/src/app/pages/cv-formatter/multi-file-import-zone.ts` :

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { catchError, of, switchMap, tap } from 'rxjs';
import { ConsultantCvsService } from '../../core/consultant-cvs/consultant-cvs.service';
import type {
  CvJobEventDto,
  CvTemplateValue,
} from '../../core/consultant-cvs/consultant-cv.model';
import { ToastService } from '../../core/notifications/toast.service';
import { Button } from '../../shared/ui/button/button';

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.docx']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;

interface FileEntry {
  readonly file: File;
  jobId: string | null;
  status: 'idle' | 'pending' | 'processing' | 'done' | 'failed';
  consultantId: string | null;
  error: string | null;
}

@Component({
  selector: 'app-multi-file-import-zone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './multi-file-import-zone.html',
})
export class MultiFileImportZone {
  private readonly cvsService = inject(ConsultantCvsService);
  private readonly toaster = inject(ToastService);

  protected readonly entries = signal<FileEntry[]>([]);
  protected readonly template = signal<CvTemplateValue>('tekteo');
  protected readonly running = signal(false);

  protected readonly canSubmit = computed(
    () => !this.running() && this.entries().length > 0,
  );

  readonly imported = output<void>();

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files) return;
    this.addFiles(Array.from(files));
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected onTemplateChange(value: string): void {
    if (value === 'tekteo' || value === 'anonyme') {
      this.template.set(value);
    }
  }

  protected removeEntry(index: number): void {
    if (this.running()) return;
    this.entries.update((list) => list.filter((_, i) => i !== index));
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    const files = this.entries().map((e) => e.file);
    this.running.set(true);

    this.cvsService
      .importMultipleFiles(files, this.template())
      .pipe(
        tap(({ jobs }) => {
          this.entries.update((list) =>
            list.map((entry, i) => ({
              ...entry,
              jobId: jobs[i]?.jobId ?? null,
              status: 'pending',
            })),
          );
          jobs.forEach(({ jobId }, i) => this.watchJob(jobId, i));
        }),
        catchError((err: unknown) => {
          this.running.set(false);
          this.toaster.error({
            title: 'Import impossible',
            description: extractErrorMessage(err),
          });
          return of(null);
        }),
      )
      .subscribe();
  }

  private watchJob(jobId: string, entryIndex: number): void {
    this.cvsService
      .watchImportJob(jobId)
      .pipe(
        tap((update: Partial<CvJobEventDto>) => {
          this.entries.update((list) =>
            list.map((entry, i) => {
              if (i !== entryIndex) return entry;
              const status =
                update.status === 'done' || update.status === 'failed'
                  ? update.status
                  : update.status ?? entry.status;
              return {
                ...entry,
                status,
                consultantId: update.consultantId ?? entry.consultantId,
                error: update.error ?? null,
              };
            }),
          );
          if (this.allDone()) {
            this.running.set(false);
            this.imported.emit();
          }
        }),
        catchError(() => {
          this.entries.update((list) =>
            list.map((entry, i) =>
              i === entryIndex
                ? { ...entry, status: 'failed', error: 'Connexion perdue' }
                : entry,
            ),
          );
          if (this.allDone()) this.running.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }

  private allDone(): boolean {
    return this.entries().every(
      (e) => e.status === 'done' || e.status === 'failed',
    );
  }

  private addFiles(files: File[]): void {
    const existing = this.entries();
    const accepted: FileEntry[] = [];
    for (const file of files) {
      if (existing.length + accepted.length >= MAX_FILES) {
        this.toaster.error({
          title: 'Trop de fichiers',
          description: `Maximum ${MAX_FILES} fichiers par import.`,
        });
        break;
      }
      if (!this.isAccepted(file)) continue;
      if (file.size > MAX_FILE_SIZE) {
        this.toaster.error({
          title: 'Fichier trop volumineux',
          description: `${file.name} dépasse la limite de 10 Mo.`,
        });
        continue;
      }
      accepted.push({
        file,
        jobId: null,
        status: 'idle',
        consultantId: null,
        error: null,
      });
    }
    if (accepted.length > 0) {
      this.entries.update((list) => [...list, ...accepted]);
    }
  }

  private isAccepted(file: File): boolean {
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (
      !ACCEPTED_MIME_TYPES.has(file.type) &&
      !ACCEPTED_EXTENSIONS.has(ext)
    ) {
      this.toaster.error({
        title: 'Format non supporté',
        description: `${file.name} : seuls PDF et DOCX sont acceptés.`,
      });
      return false;
    }
    return true;
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
```

- [ ] **Step 2: Implémenter le template**

Créer `apps/front/src/app/pages/cv-formatter/multi-file-import-zone.html` :

```html
<div class="space-y-4">
  <!-- Drop zone -->
  <label
    class="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50/60 px-6 py-10 cursor-pointer transition hover:border-brand-400 hover:bg-brand-50/40"
    (dragover)="onDragOver($event)"
    (drop)="onDrop($event)"
  >
    <svg viewBox="0 0 24 24" class="h-10 w-10 text-surface-900/30" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
    </svg>
    <p class="text-sm font-medium text-surface-900">
      Glissez vos PDF/DOCX ici, ou cliquez pour parcourir
    </p>
    <p class="text-xs text-surface-900/50">
      Maximum 10 fichiers · 10 Mo par fichier
    </p>
    <input
      type="file"
      multiple
      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      class="sr-only"
      (change)="onFilesSelected($event)"
    />
  </label>

  <!-- Sélecteur de template global -->
  <fieldset class="rounded-xl border border-surface-200 p-4">
    <legend class="px-2 text-sm font-medium text-surface-900">
      Template à utiliser
    </legend>
    <div class="flex flex-wrap gap-3 mt-1">
      <label class="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="template"
          value="tekteo"
          [checked]="template() === 'tekteo'"
          (change)="onTemplateChange('tekteo')"
        />
        <span class="text-sm text-surface-900/80">Tekteo</span>
      </label>
      <label class="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="template"
          value="anonyme"
          [checked]="template() === 'anonyme'"
          (change)="onTemplateChange('anonyme')"
        />
        <span class="text-sm text-surface-900/80">Anonyme</span>
      </label>
    </div>
  </fieldset>

  <!-- Liste des fichiers -->
  @if (entries().length > 0) {
    <ul class="space-y-2">
      @for (entry of entries(); track entry.file.name; let i = $index) {
        <li class="flex items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-2.5">
          <svg viewBox="0 0 24 24" class="h-4 w-4 text-surface-900/50 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
          </svg>
          <div class="flex-1 min-w-0">
            <p class="truncate text-sm text-surface-900">{{ entry.file.name }}</p>
            <p class="text-xs text-surface-900/50">
              @switch (entry.status) {
                @case ('idle') { Prêt }
                @case ('pending') { En attente… }
                @case ('processing') { Extraction… }
                @case ('done') { ✅ Importé }
                @case ('failed') { ❌ {{ entry.error ?? 'Échec' }} }
              }
            </p>
          </div>
          @if (entry.consultantId && entry.status === 'done') {
            <a
              [routerLink]="['/cv', entry.consultantId]"
              class="text-xs font-medium text-brand-700 hover:underline"
            >
              Voir →
            </a>
          }
          @if (entry.status === 'idle') {
            <button
              type="button"
              class="rounded-lg p-1.5 text-surface-900/40 hover:bg-red-50 hover:text-red-600"
              aria-label="Retirer ce fichier"
              (click)="removeEntry(i)"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          }
        </li>
      }
    </ul>
  }

  <!-- Bouton submit -->
  <div class="flex justify-end">
    <app-button
      variant="primary"
      [disabled]="!canSubmit()"
      [loading]="running()"
      (click)="submit()"
    >
      Lancer l'import ({{ entries().length }})
    </app-button>
  </div>
</div>
```

- [ ] **Step 3: Ajouter `RouterLink` aux imports du composant TS**

Dans `multi-file-import-zone.ts`, ajouter à la liste des imports du `@Component` :

```ts
import { RouterLink } from '@angular/router';
// ...
imports: [Button, RouterLink],
```

- [ ] **Step 4: Commit (ASK USER FIRST)**

Suggested message:
```
feat(front): add MultiFileImportZone with drag-drop, multi-SSE tracking
```

---

## Task 16: Composant `ConsultantManualForm`

**Files:**
- Create: `apps/front/src/app/pages/cv-formatter/consultant-manual-form.ts`
- Create: `apps/front/src/app/pages/cv-formatter/consultant-manual-form.html`

- [ ] **Step 1: Implémenter le composant TS**

Créer `apps/front/src/app/pages/cv-formatter/consultant-manual-form.ts` :

```ts
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
  // Identité (obligatoires : firstName + lastName + role)
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  summary: string;

  // Listes (toutes optionnelles)
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

  // -----------------------------------------------------------
  // Listes
  // -----------------------------------------------------------

  protected addSkill(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    this.state.update((s) => ({ ...s, skills: [...s.skills, trimmed] }));
  }
  protected removeSkill(i: number): void {
    this.state.update((s) => ({
      ...s,
      skills: s.skills.filter((_, idx) => idx !== i),
    }));
  }

  protected addTool(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    this.state.update((s) => ({ ...s, tools: [...s.tools, trimmed] }));
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

  // -----------------------------------------------------------
  // Submit
  // -----------------------------------------------------------

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
        experiences: s.experiences.map((e) => ({
          role: e.role,
          company: e.company,
          dateStart: e.dateStart,
          dateEnd: e.dateEnd,
          mission: e.mission,
        })),
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
```

- [ ] **Step 2: Implémenter le template**

Créer `apps/front/src/app/pages/cv-formatter/consultant-manual-form.html` :

```html
<form class="space-y-6" (submit)="$event.preventDefault(); submit()">
  <!-- Identité -->
  <section class="space-y-3">
    <h3 class="text-sm font-semibold uppercase tracking-wide text-surface-900/60">
      Identité <span class="text-red-600">*</span>
    </h3>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="text-xs text-surface-900/70">Prénom *</span>
        <input
          type="text"
          required
          [value]="state().firstName"
          (input)="updateField('firstName', $any($event.target).value)"
          class="mt-1 block w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
        />
      </label>
      <label class="block">
        <span class="text-xs text-surface-900/70">Nom *</span>
        <input
          type="text"
          required
          [value]="state().lastName"
          (input)="updateField('lastName', $any($event.target).value)"
          class="mt-1 block w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
        />
      </label>
      <label class="block sm:col-span-2">
        <span class="text-xs text-surface-900/70">Intitulé du poste *</span>
        <input
          type="text"
          required
          placeholder="Ex : Tech Lead Java"
          [value]="state().role"
          (input)="updateField('role', $any($event.target).value)"
          class="mt-1 block w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
        />
      </label>
      <label class="block">
        <span class="text-xs text-surface-900/70">Email</span>
        <input
          type="email"
          [value]="state().email"
          (input)="updateField('email', $any($event.target).value)"
          class="mt-1 block w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
        />
      </label>
      <label class="block">
        <span class="text-xs text-surface-900/70">Téléphone</span>
        <input
          type="tel"
          [value]="state().phone"
          (input)="updateField('phone', $any($event.target).value)"
          class="mt-1 block w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
        />
      </label>
      <label class="block sm:col-span-2">
        <span class="text-xs text-surface-900/70">Localisation</span>
        <input
          type="text"
          [value]="state().location"
          (input)="updateField('location', $any($event.target).value)"
          class="mt-1 block w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
        />
      </label>
      <label class="block sm:col-span-2">
        <span class="text-xs text-surface-900/70">Résumé / pitch</span>
        <textarea
          rows="3"
          [value]="state().summary"
          (input)="updateField('summary', $any($event.target).value)"
          class="mt-1 block w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
        ></textarea>
      </label>
    </div>
  </section>

  <!-- Compétences -->
  <details class="rounded-xl border border-surface-200 bg-white">
    <summary class="cursor-pointer px-4 py-3 text-sm font-semibold text-surface-900">
      Compétences ({{ state().skills.length }})
    </summary>
    <div class="border-t border-surface-200 p-4 space-y-2">
      <div class="flex flex-wrap gap-2">
        @for (skill of state().skills; track skill; let i = $index) {
          <span class="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs text-brand-800">
            {{ skill }}
            <button type="button" (click)="removeSkill(i)" aria-label="Retirer">×</button>
          </span>
        }
      </div>
      <input
        type="text"
        placeholder="Tapez puis Entrée pour ajouter…"
        (keydown.enter)="$event.preventDefault(); addSkill($any($event.target).value); $any($event.target).value=''"
        class="block w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
      />
    </div>
  </details>

  <!-- Outils -->
  <details class="rounded-xl border border-surface-200 bg-white">
    <summary class="cursor-pointer px-4 py-3 text-sm font-semibold text-surface-900">
      Outils ({{ state().tools.length }})
    </summary>
    <div class="border-t border-surface-200 p-4 space-y-2">
      <div class="flex flex-wrap gap-2">
        @for (tool of state().tools; track tool; let i = $index) {
          <span class="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-0.5 text-xs text-surface-900">
            {{ tool }}
            <button type="button" (click)="removeTool(i)" aria-label="Retirer">×</button>
          </span>
        }
      </div>
      <input
        type="text"
        placeholder="Tapez puis Entrée pour ajouter…"
        (keydown.enter)="$event.preventDefault(); addTool($any($event.target).value); $any($event.target).value=''"
        class="block w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
      />
    </div>
  </details>

  <!-- Langues -->
  <details class="rounded-xl border border-surface-200 bg-white">
    <summary class="cursor-pointer px-4 py-3 text-sm font-semibold text-surface-900">
      Langues ({{ state().languages.length }})
    </summary>
    <div class="border-t border-surface-200 p-4 space-y-2">
      @for (lang of state().languages; track $index; let i = $index) {
        <div class="grid gap-2 sm:grid-cols-[2fr_2fr_auto] items-center">
          <input
            type="text"
            placeholder="Langue (ex: Anglais)"
            [value]="lang.name"
            (input)="updateLanguage(i, { name: $any($event.target).value })"
            class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Niveau (ex: Courant — C1)"
            [value]="lang.levelLabel"
            (input)="updateLanguage(i, { levelLabel: $any($event.target).value })"
            class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
          />
          <button type="button" (click)="removeLanguage(i)" class="text-red-600 text-xs">Retirer</button>
        </div>
      }
      <button type="button" (click)="addLanguage()" class="text-xs font-medium text-brand-700">
        + Ajouter une langue
      </button>
    </div>
  </details>

  <!-- Certifications -->
  <details class="rounded-xl border border-surface-200 bg-white">
    <summary class="cursor-pointer px-4 py-3 text-sm font-semibold text-surface-900">
      Certifications ({{ state().certifications.length }})
    </summary>
    <div class="border-t border-surface-200 p-4 space-y-2">
      @for (cert of state().certifications; track $index; let i = $index) {
        <div class="grid gap-2 sm:grid-cols-[3fr_1fr_auto] items-center">
          <input
            type="text"
            placeholder="Nom de la certification"
            [value]="cert.name"
            (input)="updateCertification(i, { name: $any($event.target).value })"
            class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Année"
            [value]="cert.year"
            (input)="updateCertification(i, { year: $any($event.target).value })"
            class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
          />
          <button type="button" (click)="removeCertification(i)" class="text-red-600 text-xs">Retirer</button>
        </div>
      }
      <button type="button" (click)="addCertification()" class="text-xs font-medium text-brand-700">
        + Ajouter une certification
      </button>
    </div>
  </details>

  <!-- Formation -->
  <details class="rounded-xl border border-surface-200 bg-white">
    <summary class="cursor-pointer px-4 py-3 text-sm font-semibold text-surface-900">
      Formation ({{ state().education.length }})
    </summary>
    <div class="border-t border-surface-200 p-4 space-y-2">
      @for (edu of state().education; track $index; let i = $index) {
        <div class="grid gap-2 sm:grid-cols-[2fr_2fr_1fr_auto] items-center">
          <input
            type="text"
            placeholder="Diplôme"
            [value]="edu.degree"
            (input)="updateEducation(i, { degree: $any($event.target).value })"
            class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="École / Université"
            [value]="edu.school"
            (input)="updateEducation(i, { school: $any($event.target).value })"
            class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Année"
            [value]="edu.year"
            (input)="updateEducation(i, { year: $any($event.target).value })"
            class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
          />
          <button type="button" (click)="removeEducation(i)" class="text-red-600 text-xs">Retirer</button>
        </div>
      }
      <button type="button" (click)="addEducation()" class="text-xs font-medium text-brand-700">
        + Ajouter une formation
      </button>
    </div>
  </details>

  <!-- Expériences -->
  <details class="rounded-xl border border-surface-200 bg-white">
    <summary class="cursor-pointer px-4 py-3 text-sm font-semibold text-surface-900">
      Expériences ({{ state().experiences.length }})
    </summary>
    <div class="border-t border-surface-200 p-4 space-y-3">
      @for (exp of state().experiences; track $index; let i = $index) {
        <div class="rounded-xl bg-surface-50/60 p-3 space-y-2">
          <div class="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Titre / Rôle"
              [value]="exp.role"
              (input)="updateExperience(i, { role: $any($event.target).value })"
              class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Entreprise / Client"
              [value]="exp.company"
              (input)="updateExperience(i, { company: $any($event.target).value })"
              class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Date début (ex: Jan 2022)"
              [value]="exp.dateStart"
              (input)="updateExperience(i, { dateStart: $any($event.target).value })"
              class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Date fin (ex: Présent)"
              [value]="exp.dateEnd"
              (input)="updateExperience(i, { dateEnd: $any($event.target).value })"
              class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <textarea
            rows="2"
            placeholder="Mission / Description"
            [value]="exp.mission"
            (input)="updateExperience(i, { mission: $any($event.target).value })"
            class="block w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm"
          ></textarea>
          <button type="button" (click)="removeExperience(i)" class="text-red-600 text-xs">Retirer</button>
        </div>
      }
      <button type="button" (click)="addExperience()" class="text-xs font-medium text-brand-700">
        + Ajouter une expérience
      </button>
    </div>
  </details>

  <!-- Submit -->
  <div class="flex justify-end gap-2">
    <app-button
      variant="primary"
      type="submit"
      [disabled]="!canSubmit()"
      [loading]="submitting()"
    >
      Enregistrer le consultant
    </app-button>
  </div>
</form>
```

- [ ] **Step 3: Commit (ASK USER FIRST)**

Suggested message:
```
feat(front): add ConsultantManualForm with collapsible sections
```

---

## Task 17: Refonte de `CvFormatterPage`

**Files:**
- Modify: `apps/front/src/app/pages/cv-formatter/cv-formatter.page.ts`
- Modify: `apps/front/src/app/pages/cv-formatter/cv-formatter.page.html`

- [ ] **Step 1: Réécrire le composant TS**

Remplacer `apps/front/src/app/pages/cv-formatter/cv-formatter.page.ts` :

```ts
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { ConsultantCvsService } from '../../core/consultant-cvs/consultant-cvs.service';
import type {
  ConsultantCv,
  CvGenerationStatusValue,
  CvTemplateValue,
  LatestGeneratedCv,
} from '../../core/consultant-cvs/consultant-cv.model';
import { AppDialogService } from '../../core/dialog/app-dialog.service';
import { ToastService } from '../../core/notifications/toast.service';
import { Card } from '../../shared/ui/card/card';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { ConsultantManualForm } from './consultant-manual-form';
import { GenerateCvDialog } from './generate-cv-dialog';
import { MultiFileImportZone } from './multi-file-import-zone';

const PAGE_SIZE = 20;

type Tab = 'import' | 'manual';

interface BadgeInfo {
  readonly label: string;
  readonly color: string;
  readonly bg: string;
}

const STATUS_BADGES: Record<CvGenerationStatusValue | 'none', BadgeInfo> = {
  none: { label: 'Aucun CV', color: '#6B7280', bg: '#F3F4F6' },
  pending: { label: 'En attente', color: '#92400E', bg: '#FEF3C7' },
  processing: { label: 'En cours', color: '#92400E', bg: '#FEF3C7' },
  success: { label: 'Généré', color: '#065F46', bg: '#D1FAE5' },
  failed: { label: 'Échec', color: '#991B1B', bg: '#FEE2E2' },
};

@Component({
  selector: 'app-cv-formatter-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Card,
    DatePipe,
    MultiFileImportZone,
    ConsultantManualForm,
  ],
  templateUrl: './cv-formatter.page.html',
})
export class CvFormatterPage {
  private readonly cvsService = inject(ConsultantCvsService);
  private readonly toaster = inject(ToastService);
  private readonly authStore = inject(AuthStore);
  private readonly appDialog = inject(AppDialogService);
  private readonly cdkDialog = inject(Dialog);

  protected readonly canEdit = this.authStore.canEdit;
  protected readonly tab = signal<Tab>('import');
  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;

  protected readonly resource = rxResource({
    params: () => ({ page: this.page(), pageSize: this.pageSize }),
    stream: ({ params }) => this.cvsService.list(params),
  });

  protected readonly cvs = computed<ConsultantCv[]>(
    () => this.resource.value()?.items ?? [],
  );
  protected readonly total = computed(() => this.resource.value()?.total ?? 0);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize)),
  );
  protected readonly listLoading = computed(() => this.resource.isLoading());
  protected readonly listError = computed(
    () => this.resource.error() !== undefined,
  );

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  protected onImportFinished(): void {
    this.toaster.success({
      title: 'Import terminé',
      description: 'Les profils ont été ajoutés.',
    });
    this.resource.reload();
  }

  protected onManualCreated(): void {
    this.resource.reload();
  }

  protected nextPage(): void {
    if (this.page() < this.totalPages()) this.page.update((p) => p + 1);
  }

  protected prevPage(): void {
    if (this.page() > 1) this.page.update((p) => p - 1);
  }

  // -----------------------------------------------------------
  // Actions par ligne
  // -----------------------------------------------------------

  protected statusBadge(latest: LatestGeneratedCv | null | undefined): BadgeInfo {
    return STATUS_BADGES[latest?.status ?? 'none'];
  }

  protected onActionClick(cv: ConsultantCv): void {
    const latest = cv.latestGeneratedCv ?? null;
    if (!latest) {
      // Aucun CV → ouvre la modale de choix de template
      void this.openGenerateDialog(cv.id);
      return;
    }
    if (latest.status === 'success') {
      window.open(
        this.cvsService.buildDownloadUrl(cv.id, latest.id),
        '_blank',
      );
      return;
    }
    if (latest.status === 'failed') {
      void this.openGenerateDialog(cv.id);
      return;
    }
    // pending / processing → désactivé, no-op
  }

  protected async deleteCv(cv: ConsultantCv, event: MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const ref = this.appDialog.open<ConfirmDialog, void, boolean>(
      ConfirmDialog,
      {
        data: undefined,
        providers: [
          {
            provide: ConfirmDialog.DATA,
            useValue: {
              title: 'Supprimer ce consultant ?',
              description: cv.consultantName
                ? `« ${cv.consultantName} » et tous ses CVs générés seront supprimés.`
                : 'Ce consultant et tous ses CVs générés seront supprimés.',
              confirmLabel: 'Supprimer',
              variant: 'danger' as const,
            },
          },
        ],
      },
    );
    const confirmed = await firstValueFrom(ref.closed);
    if (!confirmed) return;

    this.cvsService.remove(cv.id).subscribe({
      next: () => {
        this.toaster.success({ title: 'Consultant supprimé' });
        this.resource.reload();
      },
      error: () =>
        this.toaster.error({
          title: 'Suppression impossible',
          description: 'Veuillez réessayer dans un instant.',
        }),
    });
  }

  protected initials(name: string | null | undefined): string {
    if (!name) return '?';
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  }

  // -----------------------------------------------------------
  // Mini-modale de choix de template
  // -----------------------------------------------------------

  private async openGenerateDialog(consultantId: string): Promise<void> {
    const ref = this.cdkDialog.open<CvTemplateValue | null>(
      GenerateCvDialog,
      { hasBackdrop: true },
    );
    const template = await firstValueFrom(ref.closed);
    if (!template) return;

    this.cvsService.generate(consultantId, template).subscribe({
      next: () => {
        this.toaster.success({
          title: 'Génération lancée',
          description: 'Le CV est en cours de production.',
        });
        // refresh dans 2s pour voir passer le statut
        setTimeout(() => this.resource.reload(), 2000);
      },
      error: () =>
        this.toaster.error({
          title: 'Génération impossible',
          description: 'Veuillez réessayer dans un instant.',
        }),
    });
  }
}
```

- [ ] **Step 2: Réécrire le template**

Remplacer `apps/front/src/app/pages/cv-formatter/cv-formatter.page.html` :

```html
<div class="space-y-6">
  <!-- En-tête -->
  <header class="space-y-1">
    <p class="text-sm font-medium text-brand-700">Consultants</p>
    <h1 class="text-3xl font-semibold tracking-tight text-surface-900">
      Gérer vos consultants
    </h1>
    <p class="text-sm text-surface-900/60">
      Importez plusieurs CV ou créez un consultant manuellement,
      puis générez des CV PDF à partir de vos templates.
    </p>
  </header>

  <!-- Bloc création (tabs) -->
  @if (canEdit()) {
    <app-card title="Ajouter un consultant">
      <div class="flex border-b border-surface-200 -mt-2 mb-4">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium transition"
          [class]="tab() === 'import' ? 'border-b-2 border-brand-700 text-brand-700' : 'text-surface-900/60 hover:text-surface-900'"
          (click)="setTab('import')"
        >
          Importer un document
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium transition"
          [class]="tab() === 'manual' ? 'border-b-2 border-brand-700 text-brand-700' : 'text-surface-900/60 hover:text-surface-900'"
          (click)="setTab('manual')"
        >
          Créer manuellement
        </button>
      </div>

      @if (tab() === 'import') {
        <app-multi-file-import-zone (imported)="onImportFinished()" />
      } @else {
        <app-consultant-manual-form (created)="onManualCreated()" />
      }
    </app-card>
  }

  <!-- Liste paginée -->
  <app-card title="Consultants enregistrés">
    @if (listLoading()) {
      <ul class="space-y-2">
        @for (placeholder of [1,2,3]; track placeholder) {
          <li class="h-16 animate-pulse rounded-xl bg-surface-100"></li>
        }
      </ul>
    } @else if (listError()) {
      <p class="text-sm text-red-700" role="alert">
        Impossible de charger les consultants.
      </p>
    } @else if (cvs().length === 0) {
      <div class="rounded-xl border border-dashed border-surface-200 bg-surface-50/60 px-4 py-10 text-center">
        <p class="text-sm font-medium text-surface-900">
          Aucun consultant enregistré.
        </p>
        <p class="mt-1 text-xs text-surface-900/60">
          Importez un CV ou créez un consultant manuellement ci-dessus.
        </p>
      </div>
    } @else {
      <ul class="space-y-2">
        @for (cv of cvs(); track cv.id) {
          <li class="group flex items-center gap-4 rounded-xl border border-surface-200/70 bg-white px-4 py-3 transition hover:border-brand-300 hover:shadow-[0_18px_40px_-16px_rgb(59_99_255/0.18)]">
            <a
              [routerLink]="['/cv', cv.id]"
              class="flex flex-1 items-center gap-4 min-w-0"
            >
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 text-sm font-semibold text-brand-800">
                {{ initials(cv.consultantName) }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-surface-900 group-hover:text-brand-800">
                  {{ cv.consultantName ?? 'Consultant sans nom' }}
                </p>
                <p class="truncate text-xs text-surface-900/60">
                  {{ cv.consultantTitle ?? 'Aucun intitulé' }}
                  @if (cv._count?.jobProfiles && cv._count!.jobProfiles > 0) {
                    · {{ cv._count!.jobProfiles }} fiche(s) liée(s)
                  }
                </p>
                <p class="mt-0.5 text-xs text-surface-900/40">
                  Créé le {{ cv.createdAt | date: 'dd MMM y' }}
                </p>
              </div>
            </a>

            <!-- Badge statut -->
            <span
              class="px-2 py-0.5 rounded-full text-xs font-medium"
              [style.background-color]="statusBadge(cv.latestGeneratedCv).bg"
              [style.color]="statusBadge(cv.latestGeneratedCv).color"
            >
              {{ statusBadge(cv.latestGeneratedCv).label }}
            </span>

            <!-- Icône action contextuelle -->
            @switch (cv.latestGeneratedCv?.status ?? 'none') {
              @case ('success') {
                <button
                  type="button"
                  class="rounded-lg p-2 text-surface-900/50 hover:bg-brand-50 hover:text-brand-700 transition"
                  aria-label="Télécharger le dernier CV"
                  (click)="onActionClick(cv)"
                >
                  <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                </button>
              }
              @case ('failed') {
                @if (canEdit()) {
                  <button
                    type="button"
                    class="rounded-lg p-2 text-surface-900/50 hover:bg-amber-50 hover:text-amber-700 transition"
                    aria-label="Régénérer le CV"
                    (click)="onActionClick(cv)"
                  >
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014.7-3.5M19 5a9 9 0 00-14.7 3.5" />
                    </svg>
                  </button>
                }
              }
              @case ('processing') {
                <span class="rounded-lg p-2 text-surface-900/30" aria-label="En cours">
                  <svg viewBox="0 0 24 24" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </span>
              }
              @case ('pending') {
                <span class="rounded-lg p-2 text-surface-900/30" aria-label="En attente">
                  <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              }
              @default {
                @if (canEdit()) {
                  <button
                    type="button"
                    class="rounded-lg p-2 text-surface-900/50 hover:bg-brand-50 hover:text-brand-700 transition"
                    aria-label="Générer un CV"
                    (click)="onActionClick(cv)"
                  >
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 4l3 3-3 3-3-3 3-3zm0 13l3 3-3 3-3-3 3-3zM4 12l3-3 3 3-3 3-3-3z" />
                    </svg>
                  </button>
                }
              }
            }

            <!-- Suppression -->
            @if (canEdit()) {
              <button
                type="button"
                class="rounded-lg p-2 text-surface-900/40 hover:bg-red-50 hover:text-red-600 transition"
                aria-label="Supprimer ce consultant"
                (click)="deleteCv(cv, $event)"
              >
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5 4v6m4-6v6M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M4 7h16" />
                </svg>
              </button>
            }

            <!-- Flèche détail -->
            <a
              [routerLink]="['/cv', cv.id]"
              class="text-surface-900/30 hover:text-brand-700 transition"
              aria-label="Voir le détail"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </li>
        }
      </ul>

      <!-- Pagination -->
      <div class="mt-4 flex items-center justify-between text-sm text-surface-900/60">
        <span>{{ total() }} consultants au total</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 border border-surface-200 disabled:opacity-40"
            [disabled]="page() <= 1"
            (click)="prevPage()"
          >
            ← Précédent
          </button>
          <span class="text-xs">
            Page {{ page() }} / {{ totalPages() }}
          </span>
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 border border-surface-200 disabled:opacity-40"
            [disabled]="page() >= totalPages()"
            (click)="nextPage()"
          >
            Suivant →
          </button>
        </div>
      </div>
    }
  </app-card>
</div>
```

- [ ] **Step 3: Build**

```bash
npx nx build front
```

Expected: build succeeds.

- [ ] **Step 4: Commit (ASK USER FIRST)**

Suggested message:
```
feat(front): rebuild CvFormatterPage with tabs, paginated list, contextual actions
```

---

## Task 18: Extension de `CvDetailPage` (section CVs générés)

**Files:**
- Modify: `apps/front/src/app/pages/cv-formatter/cv-detail.page.ts`
- Modify: `apps/front/src/app/pages/cv-formatter/cv-detail.page.html`

- [ ] **Step 1: Lire l'état actuel**

```bash
sed -n '1,40p' apps/front/src/app/pages/cv-formatter/cv-detail.page.ts
```

(L'agent doit lire le fichier complet via Read tool.)

- [ ] **Step 2: Étendre le composant TS**

Repérer la classe `CvDetailPage` et ajouter dans les imports :

```ts
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import type {
  CvTemplateValue,
  GeneratedCvDto,
} from '../../core/consultant-cvs/consultant-cv.model';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { GenerateCvDialog } from './generate-cv-dialog';
import { GeneratedCvList } from './generated-cv-list';
```

Dans le `@Component({ imports: [...] })`, ajouter `GeneratedCvList`.

Dans la classe, ajouter les nouvelles propriétés :

```ts
private readonly cdkDialog = inject(Dialog);

protected readonly generatedCvs = computed<GeneratedCvDto[]>(
  () => (this.cv()?.generatedCvs as GeneratedCvDto[] | undefined) ?? [],
);

protected onDownloadGenerated(gen: GeneratedCvDto): void {
  const id = this.cv()?.id;
  if (!id) return;
  window.open(this.cvsService.buildDownloadUrl(id, gen.id), '_blank');
}

protected async onRegenerateGenerated(gen: GeneratedCvDto): Promise<void> {
  await this.openGenerateDialog();
}

protected async onRemoveGenerated(gen: GeneratedCvDto): Promise<void> {
  const consultantId = this.cv()?.id;
  if (!consultantId) return;

  const ref = this.appDialog.open<ConfirmDialog, void, boolean>(
    ConfirmDialog,
    {
      data: undefined,
      providers: [
        {
          provide: ConfirmDialog.DATA,
          useValue: {
            title: 'Supprimer ce CV généré ?',
            description: 'Le PDF sera définitivement supprimé.',
            confirmLabel: 'Supprimer',
            variant: 'danger' as const,
          },
        },
      ],
    },
  );
  const confirmed = await firstValueFrom(ref.closed);
  if (!confirmed) return;

  this.cvsService.removeGeneratedCv(consultantId, gen.id).subscribe({
    next: () => {
      this.toaster.success({ title: 'CV supprimé' });
      this.resource.reload();
    },
    error: () =>
      this.toaster.error({
        title: 'Suppression impossible',
        description: 'Veuillez réessayer dans un instant.',
      }),
  });
}

protected async openGenerateDialog(): Promise<void> {
  const consultantId = this.cv()?.id;
  if (!consultantId) return;
  const ref = this.cdkDialog.open<CvTemplateValue | null>(
    GenerateCvDialog,
    { hasBackdrop: true },
  );
  const template = await firstValueFrom(ref.closed);
  if (!template) return;

  this.cvsService.generate(consultantId, template).subscribe({
    next: () => {
      this.toaster.success({
        title: 'Génération lancée',
        description: 'Le CV est en cours de production.',
      });
      setTimeout(() => this.resource.reload(), 2000);
    },
    error: () =>
      this.toaster.error({
        title: 'Génération impossible',
        description: 'Veuillez réessayer dans un instant.',
      }),
  });
}
```

**Adapter** les noms `cv()`, `resource`, `cvsService`, `toaster`, `appDialog` selon ce qui existe déjà dans `cv-detail.page.ts`. Si certains ne sont pas encore injectés, les ajouter (`inject(Dialog)`, `inject(ToastService)`, `inject(AppDialogService)`).

- [ ] **Step 3: Étendre le template**

Lire `cv-detail.page.html`, repérer un endroit cohérent (par exemple à la fin, après l'éditeur du profil) et ajouter :

```html
<!-- CVs générés -->
<app-card title="CVs générés">
  @if (canEdit()) {
    <button
      cardAction
      type="button"
      class="text-sm font-medium text-brand-700 hover:underline"
      (click)="openGenerateDialog()"
    >
      + Générer un nouveau CV
    </button>
  }

  <app-generated-cv-list
    [cvs]="generatedCvs()"
    [canEdit]="canEdit()"
    (download)="onDownloadGenerated($event)"
    (regenerate)="onRegenerateGenerated($event)"
    (remove)="onRemoveGenerated($event)"
  />
</app-card>
```

- [ ] **Step 4: Build**

```bash
npx nx build front
```

Expected: build succeeds.

- [ ] **Step 5: Commit (ASK USER FIRST)**

Suggested message:
```
feat(front): add generated CVs section to CvDetailPage
```

---

## Task 19: Cleanup — supprimer les artefacts obsolètes

**Files:**
- Delete: `apps/front/src/app/pages/cv-formatter/cv-import.page.ts`
- Delete: `apps/front/src/app/pages/cv-formatter/cv-import.page.html`

- [ ] **Step 1: Vérifier que `CvImportPage` n'est plus référencé**

```bash
grep -rn "CvImportPage\|cv-import.page" apps/front/src 2>/dev/null
```

Expected: aucun résultat (sinon retirer la référence avant de supprimer).

- [ ] **Step 2: Supprimer les fichiers**

```bash
rm apps/front/src/app/pages/cv-formatter/cv-import.page.ts \
   apps/front/src/app/pages/cv-formatter/cv-import.page.html
```

- [ ] **Step 3: Supprimer aussi la méthode `formatFromText` du front service ?**

Décision : la **garder** pour l'instant (c'est une méthode HTTP wrappée, pas de coût d'entretien). L'endpoint API reste exposé pour compat.

- [ ] **Step 4: Build final**

```bash
npx nx build front && npx nx build @org/api
```

Expected: deux builds en succès.

- [ ] **Step 5: Commit (ASK USER FIRST)**

Suggested message:
```
chore(front): remove deprecated single-file cv-import.page
```

---

## Task 20: Smoke test manuel end-to-end

**Files:** none (vérification manuelle)

- [ ] **Step 1: Lancer la stack en dev**

```bash
npm run dev
```

(Démarre Postgres, Redis, API et front en parallèle.)

- [ ] **Step 2: Connexion + navigation**

Ouvrir `http://localhost:4200`, se connecter avec un utilisateur `admin` ou `redacteur`, aller sur `/cv-formatter`.

- [ ] **Step 3: Vérifier la page**

- En-tête « Gérer vos consultants ».
- Bloc « Ajouter un consultant » avec 2 tabs : « Importer un document » et « Créer manuellement ».
- Bloc « Consultants enregistrés » paginé.

- [ ] **Step 4: Test création manuelle**

Tab « Créer manuellement » → remplir prénom + nom + intitulé → submit → toast succès, le profil apparaît dans la liste avec badge « Aucun CV ».

- [ ] **Step 5: Test génération depuis liste (Aucun CV)**

Cliquer sur l'icône « baguette magique » du profil créé → mini-modal de choix de template → choisir Tekteo → submit → toast « Génération lancée » → après quelques secondes (refresh auto), badge passe à « En cours » puis « Généré ».

- [ ] **Step 6: Test téléchargement depuis liste**

Sur un profil au statut « Généré », cliquer sur l'icône download → ouvrir le PDF dans un nouvel onglet, vérifier le contenu (template Tekteo rempli avec les data du profil).

- [ ] **Step 7: Test import multi-fichier**

Tab « Importer un document » → glisser 2-3 PDF/DOCX → choisir template Anonyme → « Lancer l'import » → la liste de fichiers passe à « En attente », « Extraction… », « ✅ Importé » avec lien « Voir → ». La liste consultants se rafraîchit, les nouveaux profils apparaissent avec badge « Généré » (anonyme).

- [ ] **Step 8: Test page détail**

Cliquer sur un profil → page détail. Vérifier la section « CVs générés » :

- Liste de tous les CVs générés du profil.
- Bouton « + Générer un nouveau CV » → mini-modal → choisir un autre template → nouveau CV apparaît dans la liste avec statut « En cours ».
- Bouton download sur un CV success → ouvre le PDF.
- Bouton suppression sur un CV → confirmation puis disparition.

- [ ] **Step 9: Test cas d'erreur**

- Couper temporairement la clé Anthropic (commenter `ANTHROPIC_API_KEY` dans `.env.local` + restart API) → relancer une génération depuis la modale → la ligne passe à « Échec » avec message d'erreur. Réactiver la clé.
- Tenter un upload d'un fichier `.txt` → toast d'erreur.
- Tenter un fichier > 10 Mo → toast d'erreur.

- [ ] **Step 10: Test pagination**

Si moins de 20 consultants en base, créer manuellement 25 profils minimaux pour tester. Vérifier que les boutons « Précédent » / « Suivant » fonctionnent et que les pages affichent les bons items.

- [ ] **Step 11: Test AXE accessibility**

Sur Chrome, lancer Lighthouse → Accessibility audit sur `/cv-formatter` et `/cv/:id`. Vérifier 0 violation.

- [ ] **Step 12: Pas de commit**

Le smoke test ne produit pas de fichier. Si des bugs sont trouvés, créer des tâches dédiées.

---

## Self-review notes

- **Couverture spec** : tous les éléments du spec sont couverts — schémas (T1), Prisma (T2), Puppeteer (T3-4), template fill (T5), GeneratedCv service (T6), pipeline (T7-8), service paginé (T9), endpoints (T10), wiring (T11), front service (T12), modale + composants (T13-16), refonte page (T17-18), cleanup (T19), smoke test (T20).
- **Pas de placeholder** : chaque step contient le code réel.
- **Type consistency** : `CvTemplateValue`, `CvGenerationStatusValue`, `LatestGeneratedCv`, `GeneratedCvDto`, `CvJobEventDto` cohérents entre back et front.
- **Pas de tests unitaires** (consigne utilisateur). Le smoke test manuel (T20) couvre les flux principaux.
- **Commits** : chaque tâche se termine par une suggestion de commit, à valider explicitement par l'utilisateur (ne jamais commit auto).
- **Risques connus** :
  - Le `nx test api` reste un no-op (pas de Vitest wiré côté API). Si on veut tester côté backend, il faut une tâche dédiée pour ajouter Vitest.
  - Puppeteer dans Docker nécessite des libs système — mentionné en Task 3, à vérifier au déploiement.
  - La migration Prisma assume une base locale dev — sur prod, valider le backfill manuellement.
