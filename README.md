# Tekteo AO — Monorepo

Plateforme de réponse aux appels d'offres publics IT (ESN TEKTEO).

Monorepo Nx — Angular 21 (front) + NestJS (api) + PostgreSQL/Prisma + JWT cookies HTTP-only + RBAC (admin / redacteur / lecteur).

## Stack

| Couche | Technologie |
| --- | --- |
| Monorepo | Nx 22 |
| Frontend | Angular 21 (zoneless, signals, signal-forms, rxResource) |
| Styling | TailwindCSS v4 (CSS uniquement) |
| Backend | NestJS 11 |
| Base de données | PostgreSQL 17 |
| ORM | Prisma 6 |
| Validation | Zod v4 (pipe NestJS + schémas partagés) |
| Auth | JWT (access + refresh) en cookies HTTP-only — sans Passport |
| IA | Anthropic Claude (extraction & génération via `@anthropic-ai/sdk`) |
| SSL local | OpenSSL (auto-signé) |

## Structure

```
apps/
├── front/          # Angular 21 — https://localhost:4200
└── api/            # NestJS — http://localhost:3000/api
libs/
└── shared/
    ├── schemas/    # Schémas Zod partagés (@org/schemas)
    └── types/      # Types TS partagés (@org/types)
```

## Prérequis

- Node 20+
- PostgreSQL 17 et Redis 7 accessibles localement
- npm (le projet n'utilise pas pnpm)
- Une clé API Anthropic (`ANTHROPIC_API_KEY`) pour activer les fonctionnalités IA

## Démarrage

```bash
# 1. Installer les dépendances
npm install --legacy-peer-deps

# 2. Copier les variables d'env
cp .env.example .env
# Éditer .env (DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY…)

# 3. Migration Prisma initiale
npm run prisma:migrate -- --name init

# 4. Seed des données initiales (templates, prompts, TJM)
npm run prisma:seed

# 5. Lancer front + api en parallèle
npm run dev
```

- Front : https://localhost:4200 (certificat auto-signé — accepter dans le navigateur)
- API : http://localhost:3000/api

## Scripts npm

| Script | Description |
| --- | --- |
| `npm run dev` | Lance front + api en parallèle (Nx serve) |
| `npm run build` | Build front + api |
| `npm run test` | Lance tous les tests |
| `npm run lint` | Lint tous les projets |
| `npm run prisma:generate` | Génère le client Prisma |
| `npm run prisma:migrate` | Crée et applique une migration |
| `npm run prisma:studio` | Ouvre Prisma Studio |
| `npm run prisma:seed` | Seed les données initiales (templates, prompts, TJM) |

## Auth — endpoints

| Méthode | Route | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Création de compte |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/refresh` | Rafraîchissement du token |
| POST | `/api/auth/logout` | Déconnexion |
| POST | `/api/auth/me` | Utilisateur courant |

Tous les tokens transitent en cookies HTTP-only (`access_token` + `refresh_token`).

## SSL local

Les certificats sont générés dans `apps/front/ssl/` et **ne sont pas commités**. Pour les régénérer :

```bash
mkdir -p apps/front/ssl && cd apps/front/ssl
openssl req -x509 -newkey rsa:4096 -nodes -days 365 \
  -keyout localhost-key.pem -out localhost.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1"
```
