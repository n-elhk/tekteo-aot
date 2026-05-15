# Design — Consultant + CV Variants

**Date** : 2026-05-15
**Statut** : Validé — prêt pour planification d'implémentation

## Contexte et problème

Aujourd'hui, le modèle `ConsultantCv` mélange deux responsabilités : représenter une personne (consultant) et porter un contenu de CV (`cvData` JSON). Conséquence : la méthode `adaptToJob()` (`apps/api/src/modules/consultant-cvs/consultant-cvs.service.ts:199`) crée un **nouveau** `ConsultantCv` par adaptation, ce qui pollue la liste des consultants avec des clones.

Besoin métier :
- **Un consultant = une personne unique** (identité stable, master CV de référence)
- **N variantes par consultant**, chaque variante étant un couple `(contenu adapté + template)` généré via IA à partir du master et d'un `JobProfile`
- **Plusieurs variantes possibles** pour un même triplet `(Consultant, JobProfile, Template)` (pas d'unicité)

## Choix techniques structurants

### Décomposition en trois entités distinctes

- `Consultant` : la **personne**, avec identité normalisée (colonnes top-level) + `masterCvData` (JSON canonique)
- `CvVariant` : une **déclinaison** (cvData adapté + template + JobProfile + libellé)
- `GeneratedCv` : un **artefact PDF** rattaché à une variante

L'identité du consultant (nom, prénom, email, etc.) est en colonnes top-level — plus enfouie dans le `cvData`. Cela élimine les helpers `extractIdentityName` / `extractIdentityRole` (`consultant-cvs.service.ts:271-283`) et permet recherches, index, unicité.

### Email obligatoire et unique

`Consultant.email` est `NOT NULL` + `@unique`. C'est la clé naturelle métier pour identifier un consultant.

### Cascade JobProfile → variantes

`CvVariant.jobProfileId` est `NOT NULL` avec `onDelete: Cascade`. Justification : une variante n'a de sens que dans le contexte de son JobProfile (seule façon de créer une variante = adaptation IA depuis le master + un JobProfile). Garder des variantes orphelines créerait de la dette UX sans valeur métier — le coût de régénération est négligeable, et le PDF déjà livré au client vit hors système.

### Pas de contrainte d'unicité sur (Consultant, JobProfile, Template)

Plusieurs variantes pour le même triplet sont autorisées. Trois actions distinctes existent :
- **Créer** une variante (`POST /consultants/:id/variants`) → nouvelle ligne
- **Régénérer** une variante (`POST /variants/:id/regenerate`) → écrase son `cvData`
- **Éditer** manuellement (`PATCH /variants/:id`) → patch `cvData` et/ou `name`

### Module `generation-history` : module unique `'cv'`

On garde un seul module `'cv'` (cohérent avec l'existant `consultant-cvs.service.ts:167`), discriminé par un champ `mode` dans `inputData`. Modes utilisés : `'import-text'`, `'import-file'`, `'create-variant'`, `'regenerate-variant'`.

### Format du `name` auto-généré

`{jobProfile.title} — {templateLabel} — {YYYY-MM-DD HH:mm}` (par ex. « Développeur Backend GRDF — Tekteo — 2026-05-15 14:30 »).

Mapping `templateLabel` :
- `tekteo` → « Tekteo »
- `anonyme` → « Anonyme »

Le `name` est un `String` éditable côté client si l'utilisateur préfère un libellé court.

## Modèle de données

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

model CvVariant {
  id           String   @id @default(uuid())
  consultantId String   @map("consultant_id")
  jobProfileId String   @map("job_profile_id")
  template     CvTemplate
  name         String
  cvData       Json     @map("cv_data")
  createdById  String?  @map("created_by")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt      @map("updated_at")

  consultant   Consultant    @relation(fields: [consultantId], references: [id], onDelete: Cascade)
  jobProfile   JobProfile    @relation(fields: [jobProfileId], references: [id], onDelete: Cascade)
  createdBy    User?         @relation("VariantCreator", fields: [createdById], references: [id], onDelete: SetNull)
  generatedCvs GeneratedCv[]

  @@index([consultantId])
  @@index([jobProfileId])
  @@map("cv_variants")
}

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

### Changements sur les modèles existants

- `consultant_cvs` : **supprimée**
- `job_profiles` : suppression des colonnes `cv_id` (FK vers ConsultantCv) et des champs denormalized `consultant_name`, `consultant_title`, `consultant_years_exp`, `consultant_summary` (l'info vit maintenant sur `Consultant`)
- `cv_import_jobs` : la FK `consultantCvId` est renommée `consultantId` et pointe vers `consultants`
- `generated_cvs` : `consultant_id` → `variant_id`

### Migration des données

L'application étant en cours de développement, on assume `consultant_cvs` vide à la migration. Pas de script de migration de données.

## API backend

### Modules NestJS

- `consultants` (renommé depuis `consultant-cvs`)
  - `ConsultantsController`
  - `ConsultantsService` — CRUD + import texte
  - `CvImportService` / `CvImportProcessor` — pipeline async d'import fichier (cible : `Consultant`)
- `cv-variants` (nouveau)
  - `CvVariantsController`
  - `CvVariantsService` — create, update, regenerate, remove
  - `GeneratedCvsService` — inchangé conceptuellement, recâblé sur `variantId`

### Endpoints REST

```
# Consultants
GET    /consultants                                  → PaginatedResponse<Consultant>
GET    /consultants/:id                              → Consultant (avec variants[])
POST   /consultants                                  → Consultant
PATCH  /consultants/:id                              → Consultant
DELETE /consultants/:id                              → 204 (cascade variantes + PDFs)

POST   /consultants/import/text                      → Consultant (extraction IA depuis texte)
POST   /consultants/import/file                      → CvImportJob (pipeline async)

# Variantes
GET    /consultants/:id/variants                     → CvVariant[]
POST   /consultants/:id/variants                     → CvVariant (génération IA)
  body: { jobProfileId, template, name? }
GET    /variants/:variantId                          → CvVariant
PATCH  /variants/:variantId                          → CvVariant
  body: { cvData?, name? }
POST   /variants/:variantId/regenerate               → CvVariant (écrase cvData)
DELETE /variants/:variantId                          → 204 (cascade PDFs)

# PDFs (recâblés sur variantId)
POST   /variants/:variantId/generated-cvs            → GeneratedCv
GET    /variants/:variantId/generated-cvs/:id/download
DELETE /variants/:variantId/generated-cvs/:id
```

### DTOs partagés (`@org/schemas`)

```ts
// Consultant
CreateConsultantDto { firstName, lastName, email, phone?, role?, yearsExperience?, location?, masterCvData }
UpdateConsultantDto  (partial)
ImportConsultantFromTextDto { cvText, persist?: boolean }

// CvVariant
CreateCvVariantDto    { jobProfileId, template, name? }
UpdateCvVariantDto    { cvData?, name? }
RegenerateCvVariantDto { /* vide pour l'instant */ }
```

Suppression des types : `ConsultantCv*`, `CreateConsultantCvDto`, `UpdateConsultantCvDto`, `AdaptCvToJobDto`, `FormatCvFromTextDto` (remplacé par `ImportConsultantFromTextDto`).

Les listes paginées renvoient `PaginatedResponse<T>` depuis `@org/types` (keys : `items`, `total`, `page`, `pageSize`).

### Flux : création d'une variante

```
POST /consultants/:id/variants  { jobProfileId, template, name? }
 1. Charger Consultant (404 sinon)
 2. Charger JobProfile (404 sinon)
 3. Appel Anthropic : ADAPT_SYSTEM_PROMPT + buildAdaptPrompt(consultant.masterCvData, jobProfilePayload)
 4. parseLlmJson<CvData>(generation.content)
 5. name auto si absent : `${jobProfile.title} — ${templateLabel(template)} — ${formatDate(now())}`
 6. INSERT cv_variants { consultantId, jobProfileId, template, name, cvData, createdById }
 7. history.record({ module: 'cv', mode: 'create-variant', projectId: jobProfile.projectId, ... })
 8. Réponse : { variant, usage }
```

### Flux : régénération d'une variante

```
POST /variants/:variantId/regenerate
 1. Charger CvVariant + consultant + jobProfile (404 sinon)
 2. Appel Anthropic identique à la création (depuis consultant.masterCvData)
 3. UPDATE cv_variants SET cv_data = ... WHERE id
 4. history.record({ module: 'cv', mode: 'regenerate-variant', ... })
 5. Réponse : { variant, usage }
```

### Flux : import d'un CV (texte)

```
POST /consultants/import/text { cvText, persist }
 1. Appel Anthropic : FORMAT_SYSTEM_PROMPT + buildFormatPrompt(cvText)
 2. parseLlmJson<CvData> → contient identity { firstName, lastName, email, role, ... }
 3. Si persist :
    - Extraire firstName, lastName, email, phone, role, yearsExperience, location depuis identity
    - INSERT consultants { ...identité, masterCvData: cvData }
    - Erreur 409 si email déjà existant
 4. history.record({ module: 'cv', mode: 'import-text', ... })
```

## Front Angular

### Organisation des dossiers

```
apps/front/src/app/
├── core/
│   ├── consultants/
│   │   ├── consultant.model.ts
│   │   └── consultants.service.ts
│   └── cv-variants/
│       ├── cv-variant.model.ts
│       └── cv-variants.service.ts
│
└── pages/
    └── cv-formatter/
        ├── cv-formatter.page.ts                    # liste consultants (smart)
        ├── consultant-list-section/                # présentationnel
        ├── cv-import-section/                      # import texte/fichier
        ├── consultant-manual-form/                 # form Signal Forms identité + master
        ├── consultant-details/
        │   ├── consultant-details.page.ts          # smart
        │   ├── master-cv-view/                     # affichage/édition master
        │   └── variants-list/                      # liste des variantes
        │       └── variant-row.ts                  # 1 ligne (actions)
        ├── variant-details/
        │   └── variant-details.page.ts             # smart, édition cvData + PDF
        ├── create-variant-dialog.ts                # CDK Dialog
        └── generate-cv-dialog.ts                   # CDK Dialog (recâblé sur variantId)
```

### Routes

```
/cv-formatter                              → liste consultants
/cv-formatter/consultants/:id              → détail consultant + variantes
/cv-formatter/variants/:variantId          → détail variante (édition cvData)
```

### Stores NgRx Signals

- `ConsultantsStore` (route `/cv-formatter`) : `consultants[]`, `pagination`, `loading`, actions `loadPage`, `createFromText`, `delete`
- `ConsultantDetailsStore` (route `/cv-formatter/consultants/:id`) : `consultant`, `variants[]`, `loading`, actions `load`, `updateMaster`, `createVariant`, `regenerateVariant`, `deleteVariant`
- `VariantDetailsStore` (route `/cv-formatter/variants/:variantId`) : `variant`, `loading`, actions `load`, `updateCvData`, `regenerate`, `triggerPdf`

### Conventions

- Composants **standalone** (pas de `standalone: true` explicite)
- `ChangeDetectionStrategy.OnPush` partout
- `inject()`, `input()`, `output()` (pas de décorateurs `@Input`/`@Output`)
- Native control flow : `@if`, `@for`, `@switch`
- Signal Forms (`FormRoot`, `FormField`, `form()`)
- `Dialog` de `@angular/cdk/dialog` + `DIALOG_DATA` (pattern projet)
- Angular Material : imports individuels (`MatFormField`, pas `MatFormFieldModule`)
- Tailwind pour le styling
- Accents français corrects dans tous les libellés

### Composants clés

**`create-variant-dialog`** — retourne `{ jobProfileId, template, name? }`
- Sélecteur JobProfile (autocomplete par titre)
- Sélecteur template (radio `tekteo` / `anonyme`)
- Champ `name` optionnel (placeholder = aperçu du nom auto)

**`variants-list`** (présentationnel, `input()` = `CvVariant[]`)
- Ligne : `name`, `jobProfile.title`, `template`, `updatedAt`, statut dernier PDF
- Actions par ligne (`output()`) : `regenerate`, `edit`, `downloadPdf`, `delete`

## Plan de découpage en PRs

### PR 1 — Schéma Prisma + types partagés
- Nouvelles tables `consultants`, `cv_variants`
- Modifications `generated_cvs.variant_id`, `cv_import_jobs.consultant_id`
- Suppression colonnes denormalized sur `job_profiles`
- Suppression `consultant_cvs`
- Mise à jour `@org/schemas` et `@org/types` (nouveaux DTOs, suppression anciens)
- Vérification : `nx run api:build`, `nx run front:build` (échecs en cascade attendus, corrigés ensuite)

### PR 2 — Backend
- Renommage module `consultant-cvs` → `consultants` ; déplacement fichiers
- Nouveau module `cv-variants`
- `ConsultantsService` : CRUD + `importFromText` (réutilise prompts existants)
- `CvVariantsService` : `create`, `update`, `regenerate`, `remove`
- `GeneratedCvsService` : recâblage sur `variantId`, `purgeForVariant`
- `cv-import.processor.ts` : crée un `Consultant`
- Suppression de l'ancienne logique `adaptToJob` et helpers `extractIdentity*`
- Tests : `nx run api:test`

### PR 3 — Front : services et modèles
- `core/consultants/` (service + model)
- `core/cv-variants/` (service + model)
- Suppression de `core/consultant-cvs/`

### PR 4 — Front : pages et composants (la plus grosse)
- Adaptation `consultant-list-section`, `cv-import-section`, `consultant-manual-form`
- Nouvelle page `consultant-details` + sous-composants `master-cv-view`, `variants-list`
- Nouvelle page `variant-details`
- Nouveau `create-variant-dialog`
- Recâblage `generate-cv-dialog` sur `variantId`
- Routes mises à jour
- Suppression de `cv-details/` (ancien)
- Tests : `npm test`
- Test manuel UI : import → consultant → création variante → PDF → téléchargement

### PR 5 — Nettoyage
- `grep -r "consultantCv\|ConsultantCv" apps/` doit ne rien retourner
- Doc CLAUDE.md si nécessaire

## Critères d'acceptation

1. Un consultant a une identité unique (`email` unique) et un `masterCvData`
2. La liste des consultants n'affiche **plus** de doublons issus d'adaptations IA
3. Créer une variante depuis un consultant + JobProfile + template fonctionne, le master reste inchangé
4. Régénérer une variante écrase son `cvData` sans toucher au master ni aux autres variantes
5. Éditer manuellement le `cvData` d'une variante fonctionne et persiste
6. Supprimer un JobProfile cascade les variantes liées et leurs PDFs (storage purgé)
7. Supprimer un consultant cascade variantes + PDFs
8. Un PDF généré est rattaché à une variante précise et téléchargeable
9. Le nom auto-généré d'une variante suit le format `{title} — {templateLabel} — {YYYY-MM-DD HH:mm}` et reste éditable
10. La table `generation-history` enregistre `module: 'cv'` avec `mode` discriminant

## Hors scope (à traiter plus tard si besoin)

- Versioning du master CV (FR/EN, historique des modifications)
- Variante « principale » par JobProfile (`jobProfile.activeVariantId`)
- Recherche full-text sur identité ou contenu
- Variantes manuelles (sans JobProfile) — explicitement refusé dans le brainstorming
