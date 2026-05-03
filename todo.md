# MVP — Import CV PDF/DOCX → CV Tekteo via worker IA open source

## Objectif

Remplacer la dépendance à l'API Anthropic (Claude) pour la génération/adaptation de CV par un pipeline 100 % auto-hébergé reposant sur un LLM open source. Le périmètre MVP est :

1. Importer un CV au format PDF ou DOCX depuis le front Angular.
2. Extraire le contenu via Docling côté worker Python.
3. Faire produire au LLM open source un JSON conforme au schéma `CvData` déjà utilisé dans le projet (`libs/shared/schemas`).
4. Persister le CV dans la table `ConsultantCv` existante.
5. Générer un export `.docx` (et `.pdf` à terme) à partir d'un template Word.
6. Permettre le suivi du job et le téléchargement depuis l'app Angular.

**Pas de cohabitation** : à l'issue du chantier, le module `consultant-cvs` n'importe plus du tout `AnthropicService`. Les trois flux CV (import depuis fichier, format depuis texte brut, adaptation à une fiche de poste) passent tous par le worker open source. `AnthropicService` reste en place uniquement pour les autres modules (`sections`, `bpu`, `system-prompts`, `generation-history`).

---

## Contraintes & migration

- **Schéma CV** : on réutilise `CvData` (déjà défini dans `libs/shared/schemas/src/lib/schemas.ts` et consommé par `apps/front/src/app/pages/cv-formatter`). Le schéma simpliste `{ nom, titre, experiences[], … }` du plan initial est abandonné.
- **Modèle Prisma** : on conserve `ConsultantCv` (`cvData: Json`). On ajoute un nouveau modèle `CvImportJob` pour le suivi des imports asynchrones (PDF/DOCX).
- **Module backend** : on étend le module existant `apps/api/src/modules/consultant-cvs` (ne pas créer de nouveau module CV concurrent). **Les endpoints `format-from-text` et `adapt-to-job` sont migrés vers le worker dans la même PR** — pas de feature flag, pas de double implémentation.
- **App Angular** : `apps/front` (et non `apps/web` comme le suggérait le plan initial). On étend la page `cv-formatter` existante avec un onglet "Importer depuis PDF/DOCX". Les appels existants (`formatFromText`, `adaptToJob`) côté `consultant-cvs.service.ts` ne changent pas de signature — seul le backend est rebranché.
- **Suppression Anthropic dans le module CV** : retirer `AnthropicService` des constructeurs de `ConsultantCvsService`, retirer `AnthropicModule` des imports de `consultant-cvs.module.ts`, retirer les constantes `FORMAT_SYSTEM_PROMPT`/`ADAPT_SYSTEM_PROMPT`/`HAIKU_MODEL` (déplacées côté worker Python).

---

## Stack technique

### Frontend — `apps/front` (existant)

- Angular 21+ (signals, `rxResource()`, formulaires signal, OnPush)
- Étendre `apps/front/src/app/pages/cv-formatter` avec un nouveau composant `cv-import.page.ts` :
  - Drag & drop / input file (PDF/DOCX, ≤ 10 Mo)
  - Sélection du template (`modern` / `classic`)
  - Polling sur `GET /consultant-cvs/import-jobs/:jobId` jusqu'à `done`/`failed`
  - Bouton de téléchargement final
- Étendre `apps/front/src/app/core/consultant-cvs/consultant-cvs.service.ts` avec les méthodes `importFromFile()`, `getImportJob()`, `downloadOutput()`

### Backend — `apps/api` (existant)

- NestJS 11
- Étendre le module `consultant-cvs` :
  - Nouvelle route async : `POST /consultant-cvs/import-from-file` (multipart, multer) → BullMQ
  - Nouvelle route statut : `GET /consultant-cvs/import-jobs/:jobId`
  - Nouvelle route download : `GET /consultant-cvs/import-jobs/:jobId/download`
  - **Routes existantes rebranchées sur le worker (HTTP synchrone, pas de queue)** :
    - `POST /consultant-cvs/format-from-text` → appelle `POST cv-worker/process-from-text`
    - `POST /consultant-cvs/:id/adapt-to-job` → appelle `POST cv-worker/adapt-to-job`
- Nouveau module `apps/api/src/common/queue` : configuration BullMQ + Redis, producteur du job `cv-import` (utilisé uniquement par le flux fichier, qui peut être lent)
- Nouveau service `CvImportService` (dans `consultant-cvs/`) qui orchestre : sauvegarde du fichier → création `CvImportJob` (Prisma) → enqueue BullMQ → retourne `jobId`
- Le `ConsultantCvsService` existant : garder le CRUD et la logique de persistance, retirer toute injection d'`AnthropicService`, déléguer les appels LLM à un nouveau `CvWorkerClient` (HTTP) pour `formatFromText` et `adaptToJob`
- Réception du résultat depuis le worker : pour le flux async fichier, le processor BullMQ écrit directement le `CvImportJob` puis le `ConsultantCv`
- Validation Zod sur tous les DTO (cohérent avec l'existant `ZodValidationPipe`)

### Worker IA — `apps/cv-worker` (nouveau)

- Python 3.12 + FastAPI (endpoint `POST /process` côté worker, appelé directement par BullMQ via un job processor Node OU via un mini consumer Python qui lit Redis)
- **Décision recommandée** : un job processor BullMQ côté NestJS qui appelle le worker FastAPI en HTTP synchrone (plus simple à déboguer qu'un consumer Redis Python). Le worker n'a pas à connaître Redis.
- **Docling** (`docling`) pour PDF/DOCX → Markdown structuré
- **OpenAI Python SDK** (`openai`) pour appeler Mistral.rs en local via son API OpenAI-compatible (interchangeable avec n'importe quel runtime LLM compatible si on veut switcher plus tard : Ollama, vLLM, llama.cpp, etc.)
- **Pydantic v2** pour la validation du JSON retourné (schéma miroir de `CvData`)
- **docxtpl** pour le rendu Word à partir des templates Jinja
- **LibreOffice headless** (dans le Dockerfile) pour la conversion DOCX → PDF (optionnel, phase 2)
- Géré par Nx via `nx:run-commands` (target `serve` = `uvicorn`, `build` = `pip install`)

### LLM open source — choix retenu

- **Runtime : [Mistral.rs](https://github.com/EricLBuehler/mistral.rs)** — serveur d'inférence en Rust, licence MIT, projet OSS pur (pas de société commerciale derrière). Optimisé spécifiquement pour la famille Mistral. Expose une **API OpenAI-compatible** sur `/v1/chat/completions`, ce qui permet d'utiliser le SDK `openai` côté Python.
- **Famille de modèle imposée : Mistral** (français de qualité, licence Apache 2.0, JSON fiable). Choix selon le hardware disponible :
  - **`mistralai/Mistral-Small-24B-Instruct-2501`** — recommandé. Qualité proche de Claude Haiku sur l'extraction CV en français, gestion fine des structures JSON imbriquées. Requiert ~16 Go VRAM (quantization Q4_K_M via GGUF, ou ISQ Q4K côté Mistral.rs).
  - **`mistralai/Mistral-Nemo-Instruct-2407`** (12B) — fallback si VRAM limitée (~8 Go). Bon rapport qualité/empreinte, FR très correct, contexte 128k.
  - **`mistralai/Mistral-7B-Instruct-v0.3`** — fallback minimal (~5 Go) si CPU only ou laptop. Suffisant pour `format-from-text` simple, peut être limite sur `adapt-to-job`.
- **Format des poids** : GGUF quantifié pré-fait (le plus simple — pas besoin de compte HuggingFace pour les modèles gated, démarrage immédiat). Ex. `bartowski/Mistral-Small-24B-Instruct-2501-GGUF` → fichier `Mistral-Small-24B-Instruct-2501-Q4_K_M.gguf`. Mistral.rs charge le GGUF directement.
- **Alternative ISQ** : si on veut partir des safetensors HF officiels, Mistral.rs peut quantifier on-the-fly au chargement avec `--isq Q4K`. Nécessite un `HF_TOKEN` (les modèles Mistral sur HF sont gated). Plus flexible mais setup légèrement plus long.
- **Mode structuré** : Mistral.rs supporte `response_format={"type": "json_object"}` (mode JSON souple) **et** `response_format={"type": "json_schema", "json_schema": {...}}` (validation au niveau token via grammar). On utilise le JSON Schema strict basé sur le modèle Pydantic miroir de `CvData` → ~0 % de réponses mal formées.
- **Variables d'env (côté worker)** : `LLM_BASE_URL=http://mistralrs:1234/v1`, `LLM_MODEL=mistral` (alias défini au lancement du serveur via `-a mistral`). Le worker utilise le SDK `openai` standard.
- **Démarrage du modèle** : aucune commande de "pull" séparée — Mistral.rs charge le GGUF au boot du container (volume monté pour les poids). Prévoir 14–15 Go de téléchargement HuggingFace pour le 24B Q4_K_M, et ~30 s de chargement initial en RAM/VRAM.

### Infrastructure — `docker-compose.yml`

Le compose existant (`postgres` uniquement) est étendu avec :

- `redis` (pour BullMQ)
- `mistralrs` (image `ghcr.io/ericlbuehler/mistral.rs:latest-server`, charge un GGUF au boot, volume `mistralrs-models` pour persister les poids)
- `cv-worker` (image Python custom du nouveau dossier `apps/cv-worker`)

Squelette du service Mistral.rs :

```yaml
mistralrs:
  image: ghcr.io/ericlbuehler/mistral.rs:latest-server-cuda  # ou :latest-server pour CPU
  ports:
    - '1234:1234'
  volumes:
    - mistralrs-models:/models
  command: >
    --port 1234
    -a mistral
    gguf
    -m /models
    -f Mistral-Small-24B-Instruct-2501-Q4_K_M.gguf
  deploy:                      # GPU optionnel
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

Le GGUF est téléchargé une fois manuellement dans le volume (cf. section "Commandes de développement"). Le service `cv-worker` dépend de `mistralrs`. Le service `api` (lancé en dev hors compose) consomme Redis sur `localhost:6379`.

---

## Architecture du flux

```
Angular (apps/front, cv-formatter)
  │ POST /consultant-cvs/import-from-file (multipart)
  ▼
NestJS (apps/api, consultant-cvs)
  │ 1. Sauvegarde dans apps/api/uploads/cv-imports/<uuid>.<ext>
  │ 2. INSERT CvImportJob (status=pending)
  │ 3. enqueue('cv-import', { jobId, inputPath, templateId })
  ▼
BullMQ + Redis
  │
  ▼
Job processor (Node, dans apps/api)
  │ HTTP → POST http://cv-worker:8000/process
  ▼
Worker Python (apps/cv-worker)
  │ Docling → Markdown
  │ Mistral.rs (Mistral-Small-24B, OpenAI-compat) → JSON CvData
  │ Pydantic → validation
  │ docxtpl → templates/<templateId>.docx
  │ écrit apps/api/uploads/cv-outputs/<uuid>.docx
  │ retourne { cvData, outputPath }
  ▼
Job processor (Node)
  │ UPDATE CvImportJob (status=done, outputPath, cvId)
  │ INSERT ConsultantCv (cvData)
  ▼
Angular polling
  │ GET /consultant-cvs/import-jobs/:jobId  → status=done
  │ GET /consultant-cvs/import-jobs/:jobId/download
```

---

## Structure du monorepo (delta)

```
apps/
  api/              (existant — étendu)
    prisma/
      schema.prisma   ← ajout modèle CvImportJob
    src/
      common/
        queue/                      ← nouveau (BullMQ config, processors)
      modules/
        consultant-cvs/
          consultant-cvs.controller.ts   ← +3 routes
          consultant-cvs.service.ts      ← inchangé (ancien Anthropic)
          cv-import.service.ts           ← nouveau
          cv-import.processor.ts         ← nouveau (BullMQ → HTTP worker)
    templates/
      cv-modern.docx                ← nouveau
      cv-classic.docx               ← nouveau
    uploads/
      cv-imports/                   ← nouveau (gitignore déjà OK)
      cv-outputs/                   ← nouveau

  front/            (existant — étendu)
    src/app/
      pages/cv-formatter/
        cv-import.page.ts           ← nouveau composant standalone
      core/consultant-cvs/
        consultant-cvs.service.ts   ← +méthodes import

  cv-worker/        (nouveau)
    pyproject.toml
    project.json                    ← target nx:run-commands
    src/
      main.py                       ← FastAPI app
      docling_extractor.py
      llm_client.py                 ← wrapper OpenAI SDK → Mistral.rs
      cv_schema.py                  ← Pydantic miroir de CvData
      docx_renderer.py              ← docxtpl
    Dockerfile
    tests/
      test_pipeline.py

libs/
  shared/
    schemas/                        (existant — réutilisé)
```

---

## Modèle Prisma à ajouter

À insérer dans `apps/api/prisma/schema.prisma` :

```prisma
enum CvImportStatus {
  pending
  processing
  done
  failed
}

model CvImportJob {
  id              String         @id @default(uuid())
  userId          String         @map("user_id")
  status          CvImportStatus @default(pending)
  templateId      String         @map("template_id")
  inputPath       String         @map("input_path")
  inputFilename   String         @map("input_filename")
  outputPath      String?        @map("output_path")
  cvId            String?        @map("cv_id")
  errorMessage    String?        @map("error_message")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt      @map("updated_at")

  user User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  cv   ConsultantCv? @relation(fields: [cvId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([status])
  @@map("cv_import_jobs")
}
```

Migration : `npx prisma migrate dev --name cv_import_jobs` (le `prisma.config.ts` est déjà en place suite à l'upgrade Prisma 7.8).

---

## API NestJS (extensions)

### Upload
```
POST /consultant-cvs/import-from-file
Content-Type: multipart/form-data
Auth: JWT requis, role redacteur|admin
Body:
  file: File (.pdf|.docx, ≤ 10 Mo)
  templateId: 'modern' | 'classic'

200 → { jobId: string, status: 'pending' }
```

### Statut
```
GET /consultant-cvs/import-jobs/:jobId
Auth: JWT requis (l'utilisateur ne voit que ses propres jobs)

200 → {
  jobId, status, templateId,
  cvId?: string,
  downloadUrl?: string,
  error?: string,
  createdAt, updatedAt
}
```

### Téléchargement
```
GET /consultant-cvs/import-jobs/:jobId/download
Auth: JWT requis

200 → flux .docx (Content-Disposition attachment)
404 → si pas done
```

DTO + validation Zod ajoutés dans `libs/shared/schemas/src/lib/schemas.ts`.

---

## Worker Python — endpoints

Le worker expose **trois** endpoints, tous synchrones côté HTTP. Seul `process-from-file` est consommé via BullMQ ; les deux autres sont appelés en direct depuis NestJS (réponse en quelques secondes).

### 1. Import depuis fichier (PDF/DOCX) — async côté API
```
POST http://cv-worker:8000/process-from-file
{
  "jobId": "uuid",
  "inputPath": "/data/uploads/cv-imports/uuid.pdf",
  "templateId": "modern"
}
200 → {
  "cvData": CvData,
  "outputPath": "/data/uploads/cv-outputs/uuid.docx",
  "modelUsed": "Mistral-Small-24B-Instruct-2501",
  "tokensUsed": 4123
}
```

### 2. Format depuis texte brut — sync (remplace l'ancien Anthropic)
```
POST http://cv-worker:8000/process-from-text
{
  "cvText": "..."
}
200 → {
  "cvData": CvData,
  "modelUsed": "Mistral-Small-24B-Instruct-2501",
  "tokensUsed": 2048
}
```

### 3. Adaptation à une fiche de poste — sync (remplace l'ancien Anthropic)
```
POST http://cv-worker:8000/adapt-to-job
{
  "sourceCvData": CvData,
  "jobProfile": {
    "title": "...",
    "experienceLevel": "senior",
    "requiredSkills": ["..."],
    "optionalSkills": ["..."],
    "missions": "...",
    "education": "..."
  }
}
200 → {
  "cvData": CvData,            // CV adapté
  "modelUsed": "Mistral-Small-24B-Instruct-2501",
  "tokensUsed": 5120
}
```

Le worker monte le dossier `apps/api/uploads` en volume Docker (`/data/uploads`) en lecture-écriture.

Les system prompts (équivalents `FORMAT_SYSTEM_PROMPT` et `ADAPT_SYSTEM_PROMPT` actuellement dans `consultant-cvs.service.ts`) et les builders de prompt (`buildFormatPrompt`, `buildAdaptPrompt`) sont **portés tels quels** dans le code Python du worker.

---

## Prompt LLM (réutilisable)

Le prompt doit produire un objet conforme à `CvData` (schéma riche déjà en place). On reprend la trame du `buildFormatPrompt` existant (`apps/api/src/modules/consultant-cvs/consultant-cvs.service.ts`) — c'est ce prompt qui sert de référence pour la migration.

System prompt :
```
Tu es un extracteur de données de CV. À partir du document Markdown fourni, tu retournes
UNIQUEMENT un objet JSON valide conforme au schéma demandé. Aucun texte hors JSON,
aucun markdown, aucun commentaire.
```

User prompt : structure identique à `buildFormatPrompt` (clés `identity`, `skills`, `tools`, `languages`, `certifications`, `education`, `experiences[]` avec `context`/`activities`/`results`/`tech`). Le Markdown produit par Docling remplace le `cvText` brut.

Garde-fous :
- `response_format={"type": "json_schema", "json_schema": <schema dérivé de Pydantic>}` côté appel Mistral.rs (mode strict, contrainte au niveau token)
- Validation Pydantic post-réponse pour double sécurité
- 1 retry si parsing échoue (avec ajout `"Réponds STRICTEMENT en JSON, sans texte additionnel"`)

---

## Templates Word

Templates `docxtpl` (Jinja) à placer dans `apps/api/templates/`. Variables exposées dérivent directement de `CvData` :

```jinja
{{ identity.firstName }} {{ identity.lastName }}
{{ identity.role }}
{{ identity.email }} · {{ identity.phone }}
{{ identity.location }}

{% for skill in skills %}
- {{ skill.name }} ({{ skill.level }}/100)
{% endfor %}

{% for exp in experiences %}
{{ exp.role }} — {{ exp.company }} ({{ exp.dateStart }} → {{ exp.dateEnd }})
Mission : {{ exp.mission }}
{% for activity in exp.activities %}
- {{ activity.bold }} : {{ activity.text }}
{% endfor %}
{% endfor %}
```

Deux templates pour le MVP : `cv-modern.docx`, `cv-classic.docx`.

---

## Étapes d'implémentation (ordre suggéré)

1. **Schémas partagés** : ajouter `cvImportFromFileSchema` et `cvImportJobSchema` dans `libs/shared/schemas`.
2. **Prisma** : ajouter le modèle `CvImportJob`, lancer la migration, regénérer le client Prisma.
3. **Docker compose** : ajouter `redis` et `mistralrs` ; télécharger le GGUF du modèle dans le volume `mistralrs-models` avant le premier `up`.
4. **Bootstrap worker** : créer `apps/cv-worker` (FastAPI + 3 endpoints stubés), `Dockerfile`, target Nx `serve`/`build`.
5. **Pipeline worker — texte & adapt** : porter `buildFormatPrompt` / `buildAdaptPrompt` en Python, brancher Mistral.rs via le SDK `openai` (`response_format` JSON Schema), valider via Pydantic miroir de `CvData`. C'est la base la plus simple, à faire en premier.
6. **Pipeline worker — fichier** : ajouter Docling (PDF/DOCX → Markdown) en amont du même appel LLM, puis docxtpl pour le rendu Word.
7. **NestJS — `CvWorkerClient`** : service HTTP dans `apps/api/src/common/cv-worker/` qui expose `processFromText`, `adaptToJob`, `processFromFile`.
8. **NestJS — refonte `ConsultantCvsService`** : retirer `AnthropicService` du constructeur, supprimer les méthodes/constantes liées (`FORMAT_SYSTEM_PROMPT`, `ADAPT_SYSTEM_PROMPT`, `HAIKU_MODEL`, `buildFormatPrompt`, `buildAdaptPrompt`), déléguer à `CvWorkerClient`. Mettre à jour `consultant-cvs.module.ts` (retirer `AnthropicModule`, ajouter le module `CvWorkerClient`).
9. **NestJS — queue + nouvelles routes** : module BullMQ + processor `cv-import`, ajout des 3 routes (`import-from-file`, `import-jobs/:id`, `import-jobs/:id/download`) dans le controller existant.
10. **Front** : composant `cv-import.page.ts` avec polling, bouton DL. Vérifier que `formatFromText` et `adaptToJob` côté Angular fonctionnent toujours sans changement.
11. **Tests** : unitaires Pydantic/parsing côté Python (au moins un cas réel par endpoint) ; tests d'intégration NestJS sur `ConsultantCvsService` et `CvImportService` avec `CvWorkerClient` mocké.
12. **Vérification end-to-end** : un CV PDF, un texte brut, une adaptation — les 3 chemins doivent fonctionner sans aucune clé `ANTHROPIC_API_KEY` configurée pour le module CV.
13. **Phase 2** : conversion DOCX → PDF (LibreOffice headless dans l'image worker).

---

## Commandes de développement

| Action | Commande |
|---|---|
| Lancer Postgres + Redis + Mistral.rs | `docker compose up -d postgres redis mistralrs` |
| Télécharger le GGUF Mistral (1ʳᵉ fois, ~14 Go) | `docker run --rm -v tekteo-monorepo_mistralrs-models:/models alpine sh -c "wget -O /models/Mistral-Small-24B-Instruct-2501-Q4_K_M.gguf https://huggingface.co/bartowski/Mistral-Small-24B-Instruct-2501-GGUF/resolve/main/Mistral-Small-24B-Instruct-2501-Q4_K_M.gguf"` |
| Vérifier que Mistral.rs répond | `curl http://localhost:1234/v1/models` |
| Lancer le worker Python (dev) | `nx run cv-worker:serve` |
| Lancer NestJS | `nx serve @org/api` |
| Lancer Angular | `nx serve front` |
| Tout lancer | `nx run-many -t serve -p front,@org/api,cv-worker --parallel` |
| Migrer la DB | `npx prisma migrate dev` |
| Générer le client Prisma | `npx prisma generate` |

---

## Variables d'environnement à ajouter dans `.env`

```
# Worker CV (NestJS → worker)
CV_WORKER_URL=http://localhost:8000

# Runtime LLM (côté worker Python — abstraction OpenAI-compat)
LLM_BASE_URL=http://mistralrs:1234/v1   # depuis le réseau Docker
LLM_MODEL=mistral                        # alias défini par `-a mistral` au lancement de Mistral.rs
LLM_API_KEY=not-needed                   # placeholder, le SDK openai exige la clé mais Mistral.rs ne la vérifie pas

# Redis / BullMQ
REDIS_URL=redis://localhost:6379
```

`.env.example` à mettre à jour en miroir. La variable `ANTHROPIC_API_KEY` reste utilisée par les autres modules (`sections`, `bpu`, etc.) — elle n'est plus consommée par `consultant-cvs`.

L'usage de la couche d'abstraction `LLM_BASE_URL` / `LLM_MODEL` permet de basculer plus tard vers un autre runtime OpenAI-compatible (Ollama, vLLM, llama.cpp, TGI) sans toucher au code Python — il suffit de changer le service Docker et ces deux variables.
