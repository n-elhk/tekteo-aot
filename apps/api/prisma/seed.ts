import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const SECTION_TEMPLATES = [
  {
    name: 'Présentation de la société',
    orderIndex: 1,
    promptTemplate: `Rédige la section "Présentation de la société TEKTEO" pour un mémoire technique de réponse à appel d'offres public.

Inclure :
- Identité de TEKTEO : ESN parisienne fondée en 2021, spécialisée IT et marchés publics
- Chiffres clés et positionnement
- Domaines d'expertise et références pertinentes au marché
- Gouvernance et organisation interne
- Engagements envers les marchés publics

Adapte le contenu au contexte du projet fourni.`,
  },
  {
    name: 'Compréhension du besoin',
    orderIndex: 2,
    promptTemplate: `Rédige la section "Compréhension du besoin et du contexte" pour un mémoire technique.

Sur la base du contexte du projet fourni, développer :
- Analyse et reformulation du besoin exprimé par le pouvoir adjudicateur
- Enjeux identifiés (techniques, organisationnels, humains)
- Contraintes spécifiques repérées dans le CCTP
- Démonstration de la compréhension des spécificités du marché
- Approche proposée pour répondre aux attentes`,
  },
  {
    name: 'Méthodologie et démarche projet',
    orderIndex: 3,
    promptTemplate: `Rédige la section "Méthodologie et démarche projet" pour un mémoire technique.

Développer :
- Méthodologie retenue (Agile/Scrum, cycle en V, ou hybride selon le contexte)
- Phases du projet et jalons principaux
- Outils de pilotage et de suivi (Jira, Confluence, etc.)
- Processus de gestion des risques
- Démarche de reporting et communication avec le pouvoir adjudicateur
- Modalités de livraison et de recette`,
  },
  {
    name: 'Organisation et gouvernance',
    orderIndex: 4,
    promptTemplate: `Rédige la section "Organisation et gouvernance de l'équipe projet" pour un mémoire technique.

Inclure :
- Structure de l'équipe projet proposée par TEKTEO
- Rôles et responsabilités de chaque profil
- Matrice RACI simplifiée
- Comités de pilotage et instances de gouvernance
- Modalités d'escalade et de décision`,
  },
  {
    name: 'Démarche qualité',
    orderIndex: 5,
    promptTemplate: `Rédige la section "Démarche qualité et indicateurs de performance" pour un mémoire technique.

Développer :
- Politique qualité de TEKTEO sur les projets IT
- KPIs et indicateurs de performance proposés
- Processus de recette et de validation
- Gestion des non-conformités et plan de progrès`,
  },
  {
    name: 'Plan de transition et prise en charge',
    orderIndex: 6,
    promptTemplate: `Rédige la section "Plan de transition et prise en charge" pour un mémoire technique.

Inclure :
- Phase de démarrage et de montée en compétence
- Transfer de connaissance depuis le prestataire sortant
- Plan de continuité de service pendant la transition
- Calendrier de prise en charge progressive`,
  },
];

const PRICING_GRIDS = [
  ['Chef de projet MOE', 'confirme', 650],
  ['Chef de projet MOE', 'senior', 750],
  ['Chef de projet MOE', 'expert', 900],
  ['Développeur', 'junior', 380],
  ['Développeur', 'confirme', 500],
  ['Développeur', 'senior', 620],
  ['Développeur', 'expert', 720],
  ['Lead développeur', 'senior', 680],
  ['Lead développeur', 'expert', 800],
  ['Architecte technique', 'senior', 800],
  ['Architecte technique', 'expert', 950],
  ['Ingénieur DevOps', 'confirme', 550],
  ['Ingénieur DevOps', 'senior', 680],
  ['Ingénieur QA / Testeur', 'confirme', 450],
  ['Ingénieur QA / Testeur', 'senior', 580],
  ['Business Analyst', 'confirme', 550],
  ['Business Analyst', 'senior', 680],
  ['UX Designer', 'confirme', 500],
  ['UX Designer', 'senior', 620],
  ['Consultant fonctionnel', 'confirme', 550],
  ['Consultant fonctionnel', 'senior', 680],
  ['Scrum Master', 'confirme', 580],
  ['Scrum Master', 'senior', 700],
] as const;

const GLOBAL_PROMPT = `Tu es un rédacteur technique senior spécialisé dans les réponses aux appels d'offres publics IT en France. Tu rédiges pour le compte de TEKTEO, une ESN parisienne fondée en 2021.

Règles de rédaction :
- Français professionnel, fluide, sans jargon inutile
- Vocabulaire marchés publics (pouvoir adjudicateur, titulaire, CCTP, etc.)
- Ton assertif et engagé (pas de conditionnel excessif)
- Réponses concrètes et opérationnelles, pas de généralités
- Mise en avant des engagements de TEKTEO
- Structure claire avec titres et sous-titres
- Longueur adaptée aux attentes d'un mémoire technique`;

async function seed() {
  console.log('🌱 Seeding database...');

  // System prompts
  await prisma.systemPrompt.upsert({
    where: { name: 'prompt_global' },
    update: {},
    create: {
      name: 'prompt_global',
      content: GLOBAL_PROMPT,
      model: 'claude-sonnet-4-6',
    },
  });
  console.log('  ✓ System prompts');

  // Section templates
  for (const tmpl of SECTION_TEMPLATES) {
    const existing = await prisma.sectionTemplate.findFirst({
      where: { name: tmpl.name },
    });
    if (!existing) {
      await prisma.sectionTemplate.create({ data: tmpl });
    }
  }
  console.log(`  ✓ ${SECTION_TEMPLATES.length} section templates`);

  // Pricing grids
  for (const [profileTitle, level, dailyRate] of PRICING_GRIDS) {
    const existing = await prisma.pricingGrid.findFirst({
      where: {
        profileTitle,
        experienceLevel: level as 'junior' | 'confirme' | 'senior' | 'expert',
        validTo: null,
      },
    });
    if (!existing) {
      await prisma.pricingGrid.create({
        data: {
          profileTitle,
          experienceLevel: level as 'junior' | 'confirme' | 'senior' | 'expert',
          dailyRate: dailyRate.toString(),
        },
      });
    }
  }
  console.log(`  ✓ ${PRICING_GRIDS.length} pricing grid lines`);

  console.log('✅ Seed terminé');
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
