# Consultants & génération de CV — design spec

Date: 2026-05-04
Status: brainstorming validated, awaiting user review of this doc

## Context

Le module CV actuel (`apps/front/src/app/pages/cv-formatter/` + `apps/api/src/modules/consultant-cvs/`) permet d'importer **un seul** PDF/DOCX à la fois ou de coller du texte CV ; Claude extrait les données structurées et persiste un `ConsultantCv`. Aucune génération de fichier (PDF) n'existe : les templates `cv_template_tekteo.html` et `cv_template_anonyme.html` dans `apps/api/templates/` ne sont jamais utilisés. Le champ `templateId` (`'modern' | 'classic'`) est stocké mais inerte.

Cette spec refond la feature pour aligner l'UX sur le besoin métier : import multi-fichier, création manuelle, et **génération de PDF basée sur les templates HTML existants** via une étape Claude (remplissage intelligent) suivie de Puppeteer (rendu HTML→PDF).

## Goals

- Importer **un ou plusieurs** PDF/DOCX en une seule action, avec un template global choisi à l'upload, et générer pour chaque fichier (a) un profil consultant + (b) un CV PDF.
- Permettre la **création manuelle** d'un profil via un formulaire complet (tous les champs `CvData`, seuls `consultantName` + `consultantTitle` obligatoires).
- Permettre, depuis la **page détail** d'un profil, de **générer plusieurs PDF** (un par template, ou plusieurs avec le même template).
- Permettre dans la **liste principale** un raccourci contextuel : télécharger le dernier CV (si succès), régénérer (si échec), ou générer (si aucun CV) via mini-modal.
- Renommer la section UI « CV consultants enregistrés » en « **Consultants enregistrés** ».
- Paginer la liste des consultants.

## Non-goals

- Pas d'éditeur visuel de template (les 2 templates HTML sont fixes côté API).
- Pas de tests unitaires dans cette première itération (sera ajouté plus tard).
- Pas de migration des données existantes vers la nouvelle nomenclature de templates côté UI au-delà du remap `modern → tekteo`, `classic → anonyme`.
- Pas de signature numérique du PDF, pas de protection mot de passe.
- Pas de génération automatique de PDF à la création manuelle (l'utilisateur passe par la page détail s'il veut un PDF).
- L'endpoint `POST /format-from-text` (extraction depuis texte collé) **n'est plus utilisé par l'UI** ; il peut être conservé pour une éventuelle API externe ou retiré au moment de l'implémentation (à trancher dans le plan).

## Architecture

```
                     ┌─────────────────────────────────────────────────┐
   Upload N fichiers │   Front (CvFormatterPage / CvDetailPage)        │
   + template global │   - liste consultants paginée + badge/icône     │
   ─────────────►   │   - tabs [Importer document] [Créer manuellement]│
                     │   - page détail : profil + section CVs générés  │
   Création manuelle │   - mini-modal de choix de template             │
                     └─────────────────────────────────────────────────┘
                              │ POST /api/consultant-cvs/import-from-file (multi)
                              │ POST /api/consultant-cvs                  (manuel)
                              │ POST /api/consultant-cvs/:id/generate     (régénérer)
                              │ GET  /api/consultant-cvs/:id/generated-cvs/:genId/download
                              ▼
                     ┌─────────────────────────────────────────────────┐
                     │            API Nest (consultant-cvs)             │
                     │   ┌───────────────┐    ┌──────────────────────┐ │
                     │   │ConsultantCvs  │    │  GeneratedCvService  │ │
                     │   │  Service      │    │  - createPending     │ │
                     │   │ (paginé,      │    │  - markSuccess/Fail  │ │
                     │   │  + latestCv)  │    └──────────┬───────────┘ │
                     │   └───────┬───────┘               │             │
                     │           │      Bull Queue ──► CvImportProcessor (étendu)
                     │           │                       │             │
                     │           │       extract → IA fill template → puppeteer → store PDF
                     │           │                       │             │
                     │   SSE /events ◄──────────────────┘              │
                     └─────────────────────────────────────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Storage local    │  (réutilise StorageService existant)
                       │ /storage/cv/...  │   {consultantId}/{generatedCvId}.pdf
                       └─────────────────┘
```

### Pipeline d'un job d'**import** (par fichier uploadé)

1. Extraction texte (PDF/DOCX → texte) — déjà en place.
2. Extraction structurée par Claude (texte → `CvData`) — déjà en place. À ce stade : profil `ConsultantCv` créé, `consultantId` connu et émis sur SSE.
3. **Nouveau** : Claude reçoit (a) le HTML du template choisi + (b) les `CvData` structurées → renvoie l'HTML rempli (placeholders remplacés, contenu adapté au format du template).
4. **Nouveau** : Puppeteer rend l'HTML en PDF.
5. **Nouveau** : le PDF est stocké dans `cv/{consultantId}/{generatedCvId}.pdf`, la ligne `generated_cvs` passe en `success`. SSE émet `done` avec `generatedCvId`.
6. En cas d'erreur à n'importe quelle étape : la ligne `generated_cvs` passe en `failed` avec `errorMessage`, SSE émet `failed`.

### Pipeline d'un job de **generate** (depuis la page détail)

Identique mais commence à l'étape 3 — les `CvData` existent déjà. `consultantId` est requis dès la création du job.

### Pipeline de **création manuelle**

POST `/api/consultant-cvs` synchrone : insert direct, pas de job, pas de génération PDF.

## Modèle de données (Prisma)

### Nouveau : `GeneratedCv`

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

model GeneratedCv {
  id           String             @id @default(uuid())
  consultantId String             @map("consultant_id")
  template     CvTemplate
  status       CvGenerationStatus @default(pending)
  outputPath   String?            @map("output_path")    // chemin storage du PDF
  filename     String?                                    // nom de download propre
  errorMessage String?            @map("error_message")
  createdById  String?            @map("created_by")
  createdAt    DateTime           @default(now()) @map("created_at")
  updatedAt    DateTime           @updatedAt      @map("updated_at")

  consultant ConsultantCv @relation(fields: [consultantId], references: [id], onDelete: Cascade)
  createdBy  User?        @relation("GeneratedCvCreator", fields: [createdById], references: [id], onDelete: SetNull)

  @@index([consultantId])
  @@index([status])
  @@map("generated_cvs")
}
```

### Évolution : `ConsultantCv`

- Ajout d'un champ `updatedAt @updatedAt @map("updated_at")` (utile pour suivre les modifs profil).
- Nouvelle relation inverse `generatedCvs GeneratedCv[]`.
- Pas de renommage de table (`consultant_cvs` reste).

### Évolution : `CvImportJob`

Conserver le nom de table `cv_import_jobs` (décision validée). Ajouts :

- `kind: CvJobKind` enum (`import` | `generate`).
- `consultantId: String?` — null à la création d'un `import`, set après extraction ; requis dès la création d'un `generate`.
- `generatedCvId: String?` — set quand le PDF est rendu.
- `template` typé via la nouvelle enum `CvTemplate` (au lieu du `templateId: String` libre actuel).
- Ancien champ `outputPath` conservé (chemin du PDF du job, redondant avec `GeneratedCv.outputPath` ; à dédupliquer dans le plan).

```prisma
enum CvJobKind {
  import
  generate
  @@map("cv_job_kind")
}
```

### Migration des templates `modern | classic` → `tekteo | anonyme`

Le `templateId` actuel n'est jamais utilisé pour produire un fichier. La migration :

1. Crée la nouvelle enum `cv_template`.
2. Remap les valeurs en base (`modern → tekteo`, `classic → anonyme`).
3. Convertit la colonne `template_id String` → `template cv_template`.

Si la base prod ne contient que des valeurs de jobs « historiques » sans impact (pas de PDF généré derrière), la migration est sans risque.

## API contract

Convention de pagination alignée sur `generation-history.service` : `?page=1&pageSize=20` → réponse `{ items, total, page, pageSize }`. Max `pageSize = 100`.

### Profils consultants

| Méthode | Route | Évolutions |
|---|---|---|
| `GET` | `/api/consultant-cvs?page=&pageSize=` | **Paginé**. Chaque item inclut `latestGeneratedCv: { id, status, template, updatedAt } \| null` (sub-query Prisma `include`). |
| `GET` | `/api/consultant-cvs/:id` | Inclut `generatedCvs: GeneratedCv[]` (tri `updatedAt desc`). |
| `POST` | `/api/consultant-cvs` | Body Zod strict : `consultantName` + `consultantTitle` obligatoires (max 200 chars). `cvData` permissif (record). Pas de génération auto. |
| `PATCH` | `/api/consultant-cvs/:id` | inchangé |
| `DELETE` | `/api/consultant-cvs/:id` | Avant le delete Prisma (qui cascade `generated_cvs`), le service supprime les fichiers PDF du storage pour éviter les orphelins. |

### Import multi-fichier

| Méthode | Route | Évolutions |
|---|---|---|
| `POST` | `/api/consultant-cvs/import-from-file` | Multipart : `files[]` (max 10), `template: 'tekteo' \| 'anonyme'`. Crée N `CvImportJob(kind='import')` + retourne `{ jobs: [{ jobId, status }, ...] }`. |
| `GET` | `/api/consultant-cvs/import-jobs/:jobId` | Payload `CvJobDto` (discriminated union par `kind`). |
| `GET` | `/api/consultant-cvs/import-jobs/:jobId/events` | SSE émet `CvJobEvent` (discriminated union). |

### Génération depuis la page détail

| Méthode | Route | But |
|---|---|---|
| `POST` | `/api/consultant-cvs/:id/generate` | Body : `{ template: 'tekteo' \| 'anonyme' }`. Crée un `CvImportJob(kind='generate', consultantId=:id)` + retourne `{ jobId, status }`. |

### CV générés

| Méthode | Route | But |
|---|---|---|
| `GET` | `/api/consultant-cvs/:id/generated-cvs/:genId/download` | Stream le PDF (`Content-Disposition: attachment; filename=…`). 409 si `status != success`. Filename généré serveur : `{consultantName-slug}_{template}.pdf`. |
| `DELETE` | `/api/consultant-cvs/:id/generated-cvs/:genId` | Supprime la ligne + le fichier PDF (idempotent si fichier déjà absent). |

### DTOs partagés (`@org/schemas`)

```ts
export const cvTemplateSchema = z.enum(['tekteo', 'anonyme']);
export type CvTemplateValue = z.infer<typeof cvTemplateSchema>;

export const cvGenerationStatusSchema = z.enum([
  'pending', 'processing', 'success', 'failed',
]);

export const generatedCvSchema = z.object({
  id: z.uuid(),
  template: cvTemplateSchema,
  status: cvGenerationStatusSchema,
  filename: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

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

export const generateCvFromTemplateSchema = z.object({
  template: cvTemplateSchema,
});

export const createConsultantCvSchema = z.object({
  cvData: cvDataSchema,
  consultantName: z.string().min(1).max(200),    // requis
  consultantTitle: z.string().min(1).max(200),   // requis
});
```

### Permissions

- `GET` (list, get, download) : tout authentifié (`admin`, `redacteur`, `lecteur`).
- `POST`, `PATCH`, `DELETE`, `generate`, `import-from-file`, `delete generated` : `admin` + `redacteur`. Cohérent avec le `canEdit()` du `AuthStore`.

## Frontend

### Routes

| Route | État | Composant |
|---|---|---|
| `/cv-formatter` | refondu | `CvFormatterPage` (tabs création + liste paginée) |
| `/cv/:id` | étendu | `CvDetailPage` (profil + section CVs générés) |

Pas de nouvelle route `/cv/new` — le formulaire manuel vit dans un tab de `/cv-formatter`.

### Page `/cv-formatter`

Structure verticale :

1. **En-tête** : titre + sous-titre.
2. **Carte « Ajouter un consultant »** avec **2 tabs** :
   - **Tab 1 — Importer un document** : drop zone multi-fichier (input `multiple`, drag-drop, accept `.pdf,.docx`, max 10 fichiers, max 10 Mo/fichier) + radio `template: tekteo | anonyme` + bouton « Lancer l'import ». Liste live des fichiers en cours avec statut SSE par ligne et lien vers `/cv/:id` quand le `consultantId` arrive.
   - **Tab 2 — Créer manuellement** : formulaire long avec sections collapsibles (identité avec `consultantName`/`consultantTitle` requis, compétences, outils, langues, certifications, formation, expériences). Save → POST `/api/consultant-cvs` → toast succès + reset du formulaire + reload de la liste, **pas de redirection**.
3. **Bloc « Consultants enregistrés »** :
   - Pagination prev/next (20/page par défaut).
   - Pour chaque ligne : avatar (initiales), nom, intitulé, nbre fiches liées, date.
   - **Badge** statut du dernier CV : `✅ Généré` / `⏳ En cours` / `❌ Échec` / `⚪ Aucun CV` (couleurs distinctes, template au survol).
   - **Icône action contextuelle** :
     - `success` → `download` (clic = GET `/download` direct, le navigateur télécharge).
     - `failed` → `refresh` (clic = ouvre le mini-modal pour rechoisir le template).
     - `processing` / `pending` → `loader` désactivée.
     - aucun CV → `wand` (clic = ouvre le mini-modal de génération).
   - Icône `delete` (existant).
   - Lien `<a routerLink="/cv/:id">` couvrant la ligne (existant).

### Page `/cv/:id`

Existant : profil affichable/éditable. **Ajouts** :

- Section **« CVs générés »** sous le profil :
  - Bouton « Générer un nouveau CV » → ouvre le mini-modal de choix de template.
  - Liste de tous les `generatedCvs` (tri `updatedAt desc`) :
    - Badge template (`Tekteo` / `Anonyme`).
    - Badge statut.
    - Date de création.
    - Icône `download` si `success` (GET `/download`).
    - Icône `refresh` si `failed` (ouvre le mini-modal pour rechoisir le template).
    - Icône `delete` (DELETE `/:id/generated-cvs/:genId`, confirmation via `ConfirmDialog`).
    - Si `failed` : `errorMessage` en tooltip.

### Composants nouveaux

- `MultiFileImportZone` : drop zone + liste fichiers + statut live multi-SSE.
- `ConsultantManualForm` : formulaire long, signal forms (`form()`, `FormField`).
- `GeneratedCvList` : présentationnel, prend `generatedCvs: GeneratedCv[]` en `input()` et émet `(download)`, `(regenerate)`, `(remove)` en `output()`.
- `GenerateCvDialog` : mini-modal `Dialog` Material avec radio template.

### Suppressions

- Bloc « Extraction depuis du texte » : retiré du template.
- Composant `cv-import.page` (mono-fichier) : remplacé par `MultiFileImportZone`.

### State management

- `ConsultantCvsService` étendu avec : `list({ page, pageSize })`, `importMultipleFiles(files, template)`, `generate(consultantId, template)`, `downloadGeneratedCv(consultantId, genId)`, `deleteGenerated(consultantId, genId)`.
- Pas de NgRx Signals dédié — scope local par composant via `rxResource()` et `signal()`.
- Le SSE multi-job : `Map<jobId, JobState>` dans `MultiFileImportZone`, mis à jour par chaque `EventSource`.

## Génération du PDF — détails techniques

### Étape 1 : Claude remplit le template

- Prompt système : « Tu es un assistant qui remplit un template HTML de CV à partir de données structurées. Tu reçois (a) le HTML du template avec des placeholders, (b) un JSON de données. Tu renvoies l'HTML final, sans le moindre commentaire, sans markdown. »
- Inputs : template HTML brut + `JSON.stringify(cvData)`.
- Output attendu : HTML pur.
- Modèle : Claude Sonnet 4.6 (suffisant ; Opus est overkill pour du fill template).
- Cache prompt : le template HTML est statique et long → **prompt caching** activé sur le bloc template (`cache_control: { type: 'ephemeral' }`).

### Étape 2 : Puppeteer rend en PDF

- Lib : `puppeteer` (npm). Installation lourde mais rendu CSS moderne fiable.
- Une instance Chromium partagée au niveau du processor (singleton) — pool de pages.
- Options PDF : `format: 'A4'`, `printBackground: true`, marges raisonnables (`20mm`).
- Timeout par génération : 30s.

### Étape 3 : stockage

- Réutilise le `StorageService` existant (`apps/api/src/common/storage/`).
- Convention de chemin : `cv/{consultantId}/{generatedCvId}.pdf`.
- `filename` propre stocké dans `generated_cvs.filename` : `{consultantName-slug}_{template}.pdf`.

## Flux d'erreur

**1. Upload multi-fichier**
- Format / taille invalide : refus client-side avec toast (existant).
- Échec d'un job : les autres continuent indépendamment.
- Perte SSE : ferme proprement, bouton « rafraîchir » repoll `GET /import-jobs/:jobId`.
- Page quittée pendant les jobs : Bull continue, polling au retour.

**2. Pipeline génération** — `errorMessage` typé :
- `extraction_failed` : extraction PDF/DOCX KO.
- `template_fill_failed` : Claude n'a pas produit un HTML valide.
- `pdf_render_failed` : Puppeteer crash ou timeout.
- `storage_write_failed` : écriture fichier impossible.
- Toutes retryables via le bouton « régénérer » (mini-modal pour choisir le template).

**3. Téléchargement**
- `GET /download` sur un statut `≠ success` → **409 Conflict** avec message clair.
- Filename : généré serveur (slug du nom + template), pas d'input utilisateur.

**4. Suppressions**
- `GeneratedCv` : delete row + delete fichier (idempotent, log si fichier absent).
- `Consultant` : avant delete cascade, le service purge les PDFs des `generated_cvs` liés.

**5. Concurrence**
- 2 régénérations rapides sur le même couple (consultant, template) : Bull les traite en série, l'historique reflète chaque tentative. L'utilisateur peut nettoyer manuellement.
- Le badge de la liste utilise toujours le `latestGeneratedCv` (par `updatedAt desc`).

**6. Sécurité**
- `JwtAuthGuard` partout.
- `RolesGuard` : `lecteur` → list/get/download seulement.
- Path traversal impossible : tous les chemins fichiers dérivés serveur.
- Limite multipart : 10 fichiers, 10 Mo/fichier (existant).

## Performance

- Liste paginée : `LIMIT/OFFSET` Prisma + `count(*)` parallèle.
- Sub-query `latestGeneratedCv` : `include: { generatedCvs: { orderBy: { updatedAt: 'desc' }, take: 1 } }` (pas de N+1).
- Puppeteer : instance Chromium singleton + pool de pages (5 max), pas de spawn par job.
- Bull queue : concurrence configurée à 2 jobs simultanés (Claude + Puppeteer = lourd).

## Implementation order (à raffiner par writing-plans)

1. **Schémas partagés** (`@org/schemas`) : nouvelles enums + DTOs (`cvTemplateSchema`, `cvGenerationStatusSchema`, `generatedCvSchema`, `cvJobEventSchema`, `generateCvFromTemplateSchema`, durcissement de `createConsultantCvSchema`).
2. **Migration Prisma** : nouvelle table `generated_cvs`, ajout `kind`/`consultant_id`/`generated_cv_id` sur `cv_import_jobs`, remap `template_id → template` enum.
3. **Backend — services** : `GeneratedCvService` (CRUD + storage), évolution de `ConsultantCvsService` (pagination, `latestGeneratedCv`, durcissement create), évolution de `CvImportProcessor` (étape `fillTemplate` Claude + `renderToPdf` Puppeteer + persistance `generated_cvs`).
4. **Backend — contrôleur** : nouveaux endpoints `POST /:id/generate`, `GET /:id/generated-cvs/:genId/download`, `DELETE /:id/generated-cvs/:genId` ; multi-fichier sur `import-from-file` ; pagination sur `GET /`.
5. **Front — service & modèles** : extension `ConsultantCvsService` (méthodes manquantes) + types alignés sur les schémas.
6. **Front — composants** : `MultiFileImportZone`, `ConsultantManualForm`, `GeneratedCvList`, `GenerateCvDialog`.
7. **Front — pages** : refonte de `CvFormatterPage` (tabs + liste paginée + badges/icônes), extension de `CvDetailPage` (section CVs générés).
8. **Cleanup** : retrait du bloc « Extraction depuis du texte » et du composant mono-fichier `cv-import.page`.

## Risks & open questions

- **Puppeteer dans Docker** : nécessite des fonts + libs système (`libnss3`, `libatk-bridge`, `libgbm`, fonts) ; le `Dockerfile` de l'API devra être mis à jour. Plan à compléter sur ce point.
- **Prompt caching** : à activer sur le bloc template HTML pour réduire le coût (le template fait 18-40 KB, économies significatives).
- **Endpoint `format-from-text`** : à trancher entre dépréciation et conservation lors du plan d'implémentation.
- **Migration des données existantes** : si la prod contient des `cv_import_jobs` avec `templateId='modern'`, le remap est trivial. Si d'autres valeurs sont présentes, il faudra les inventorier avant la migration.
- **Concurrent generations** : la décision actuelle (autoriser, historiser) peut produire un historique long. Ajouter une option de purge automatique au bout de N succès gardés ? Hors scope pour cette itération.
