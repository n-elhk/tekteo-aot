export interface JobProfilePayload {
  title: string;
  experienceLevel: string;
  requiredSkills: string[];
  optionalSkills: string[];
  missions: string;
  education: string;
}

export const FORMAT_SYSTEM_PROMPT =
  "Tu es un expert en extraction de données de CV. " +
  "Tu analyses le texte brut d'un CV et retournes UNIQUEMENT un objet JSON valide, " +
  'sans markdown, sans balises, sans commentaires.';

export const ADAPT_SYSTEM_PROMPT =
  "Tu es un expert en rédaction de CV techniques pour une ESN " +
  "(entreprise de services numériques).\n" +
  "Tu adaptes un CV existant à une fiche de poste sans inventer d'expérience.\n" +
  'Tu retournes UNIQUEMENT un objet JSON valide, sans markdown, sans balises, ' +
  'sans commentaires.';

export function buildFormatPrompt(cvText: string): string {
  return `Extrais les données de ce CV et retourne un JSON avec exactement cette structure.
Toutes les clés sont obligatoires — mets "" ou [] si l'information est absente.

{
  "identity": {
    "firstName": "Prénom",
    "lastName": "NOM EN MAJUSCULES",
    "initials": "PN",
    "role": "Titre du poste — Spécialité principale",
    "subtitle": "X ans d'expérience · secteur principal",
    "email": "",
    "phone": "",
    "location": "Ville, Pays",
    "linkedin": ""
  },
  "skills": [{ "name": "Compétence technique", "level": 85 }],
  "tools": ["Outil1", "Outil2"],
  "languages": [{ "name": "Français", "levelLabel": "Natif", "dots": 5 }],
  "certifications": [{ "name": "Nom certification", "year": "2024" }],
  "education": [{ "degree": "Diplôme", "year": "2020", "school": "École / Université" }],
  "experiences": [
    {
      "role": "Titre du poste",
      "company": "Nom du client / entreprise",
      "clientMeta": "Mission via [ESN] — [Direction / Service]",
      "dateStart": "Mois. Année",
      "dateEnd": "Mois. Année ou Présent",
      "duration": "X ans Y mois",
      "location": "Ville — Télétravail / Sur site / Hybride",
      "context": {
        "team": "N personnes",
        "methodology": "Méthodo agile/cycle V/etc.",
        "role": "Rôle dans l'équipe",
        "extraLabel": "Domaine ou Utilisateurs",
        "extraValue": "valeur"
      },
      "mission": "Description de la mission en 2-3 phrases complètes.",
      "activities": [{ "bold": "Thème", "text": "description détaillée" }],
      "results": [{ "value": "−35%", "label": "description courte" }],
      "tech": [{ "category": "Back", "items": "Tech1, Tech2" }]
    }
  ]
}

Règles :
- level des compétences : senior=90+, confirmé=70-85, notions=30-50
- dots des langues : 5=natif, 4=courant/B2-C1, 3=intermédiaire/B1, 2=débutant, 1=notions
- Trie les expériences du plus récent au plus ancien
- Pour results : génère 3 résultats chiffrés par expérience, estime si pas explicites
- Limite à 5 compétences max, 8 outils max

CV à analyser :
${cvText}`;
}

export function buildAdaptPrompt(
  cvData: unknown,
  jobProfile: JobProfilePayload,
): string {
  const required = jobProfile.requiredSkills.join(', ') || 'non précisées';
  const optional = jobProfile.optionalSkills.join(', ') || 'non précisées';

  return `Adapte ce CV à la fiche de poste suivante, en respectant strictement les règles :

FICHE DE POSTE :
- Intitulé : ${jobProfile.title}
- Niveau : ${jobProfile.experienceLevel}
- Compétences requises : ${required}
- Compétences souhaitées : ${optional}
- Description missions : ${jobProfile.missions || 'non précisée'}
- Formation souhaitée : ${jobProfile.education || 'non précisée'}

RÈGLES D'ADAPTATION :
1. identity.role → remplacer par l'intitulé de la fiche (ou un titre très proche si plus précis)
2. identity.subtitle → adapter pour mentionner les compétences clés de la fiche
3. skills → réordonner pour mettre en avant les compétences requises de la fiche en premier
4. tools → réordonner pour mettre les outils mentionnés dans la fiche en premier
5. experiences[*].mission → reformuler légèrement (1-2 phrases) pour faire ressortir la pertinence
6. Ne jamais inventer de compétence, d'expérience ou d'information absente du CV d'origine
7. Conserver toutes les autres données intactes (dates, entreprises, activités, etc.)

CV D'ORIGINE (JSON) :
${JSON.stringify(cvData, null, 2)}

Retourne UNIQUEMENT le JSON adapté avec la même structure que le CV d'origine.`;
}
