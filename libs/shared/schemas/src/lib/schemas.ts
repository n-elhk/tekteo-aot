import { z } from 'zod';

// ============================================================
// Auth schemas
// ============================================================

export const loginSchema = z.object({
  email: z.email({ message: 'Email invalide' }),
  password: z
    .string()
    .min(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' }),
});

export const registerSchema = loginSchema.extend({
  name: z
    .string()
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(80, { message: 'Le nom ne peut pas dépasser 80 caractères' }),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;

// ============================================================
// User schemas
// ============================================================

export const roleSchema = z.enum(['admin', 'redacteur', 'lecteur']);
export type RoleValue = z.infer<typeof roleSchema>;

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(80, { message: 'Le nom ne peut pas dépasser 80 caractères' })
    .optional(),
  email: z.email({ message: 'Email invalide' }).optional(),
  role: roleSchema.optional(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

// ============================================================
// Project schemas
// ============================================================

export const projectStatusSchema = z.enum([
  'brouillon',
  'en_cours',
  'finalise',
  'soumis',
]);
export type ProjectStatusValue = z.infer<typeof projectStatusSchema>;

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(200),
  clientName: z
    .string()
    .min(2, { message: 'Le nom du client est requis' })
    .max(200),
  marketReference: z.string().max(100).optional(),
  marketObject: z.string().max(2000).optional(),
  deadline: z.iso.date().optional(),
  technologies: z.array(z.string()).default([]),
  durationMonths: z.number().int().positive().optional(),
  lots: z.array(z.string()).default([]),
  status: projectStatusSchema.default('brouillon'),
  sourceAoId: z.string().optional(),
});
export type CreateProjectDto = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial();
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

// ============================================================
// Section schemas
// ============================================================

export const sectionStatusSchema = z.enum(['brouillon', 'valide']);

export const createSectionSchema = z.object({
  templateId: z.uuid().optional(),
  title: z.string().min(1).max(200),
  content: z.string().default(''),
  orderIndex: z.number().int().nonnegative().default(0),
  status: sectionStatusSchema.default('brouillon'),
});
export type CreateSectionDto = z.infer<typeof createSectionSchema>;

export const updateSectionSchema = createSectionSchema.partial();
export type UpdateSectionDto = z.infer<typeof updateSectionSchema>;

export const claudeAttachmentSchema = z.object({
  name: z.string().min(1).max(200),
  mediaType: z.enum(['application/pdf', 'text/plain']),
  data: z.string().min(1),
});

export const generateSectionRequestSchema = z.object({
  instructions: z.string().max(4000).optional(),
  attachments: z.array(claudeAttachmentSchema).max(5).optional(),
  baseContent: z.string().max(50000).optional(),
  model: z.string().min(2).max(80).optional(),
});
export type GenerateSectionRequestDto = z.infer<
  typeof generateSectionRequestSchema
>;

// ============================================================
// SectionTemplate schemas
// ============================================================

export const createSectionTemplateSchema = z.object({
  name: z.string().min(2).max(200),
  promptTemplate: z
    .string()
    .min(10, { message: 'Le prompt doit contenir au moins 10 caractères' })
    .max(8000),
  defaultContent: z.string().max(8000).optional(),
  orderIndex: z.number().int().nonnegative().default(0),
});
export type CreateSectionTemplateDto = z.infer<typeof createSectionTemplateSchema>;

export const updateSectionTemplateSchema = createSectionTemplateSchema.partial();
export type UpdateSectionTemplateDto = z.infer<typeof updateSectionTemplateSchema>;

// ============================================================
// SystemPrompt schemas
// ============================================================

export const updateSystemPromptSchema = z.object({
  content: z
    .string()
    .min(10, { message: 'Le contenu doit faire au moins 10 caractères' })
    .max(20000),
  model: z.string().min(2).max(80).optional(),
});
export type UpdateSystemPromptDto = z.infer<typeof updateSystemPromptSchema>;

// ============================================================
// JobProfile schemas
// ============================================================

export const experienceLevelSchema = z.enum([
  'junior',
  'confirme',
  'senior',
  'expert',
]);
export type ExperienceLevelValue = z.infer<typeof experienceLevelSchema>;

export const remunerationTypeSchema = z.enum(['freelance', 'cdi', 'les_deux']);

export const createJobProfileSchema = z.object({
  title: z.string().min(2).max(200),
  experienceLevel: experienceLevelSchema,
  requiredSkills: z.array(z.string().max(100)).default([]),
  optionalSkills: z.array(z.string().max(100)).default([]),
  missions: z.string().max(8000).default(''),
  education: z.string().max(2000).default(''),
  location: z.string().max(200).default(''),
  // Champs additionnels (template Word)
  reference: z.string().max(200).optional(),
  marketContext: z.string().max(4000).optional(),
  missionType: z.string().max(200).optional(),
  duration: z.string().max(200).optional(),
  remoteWork: z.string().max(200).optional(),
  startDate: z.string().max(200).optional(),
  consultantStatus: z.string().max(200).optional(),
  clientSector: z.string().max(200).optional(),
  specificRequirements: z.array(z.string().max(500)).default([]),
  // Pricing
  tjmLow: z.string().max(20).optional(),
  tjmHigh: z.string().max(20).optional(),
  tjmRecommended: z.string().max(20).optional(),
  salaryLow: z.string().max(20).optional(),
  salaryHigh: z.string().max(20).optional(),
  salaryRecommended: z.string().max(20).optional(),
  salaryWarning: z.string().max(2000).optional(),
  quantityNeeded: z.number().int().positive().default(1),
  remunerationType: remunerationTypeSchema.optional(),
  boondmanagerUrl: z.url().max(500).optional().or(z.literal('')),
});
export type CreateJobProfileDto = z.infer<typeof createJobProfileSchema>;

export const updateJobProfileSchema = createJobProfileSchema.partial().extend({
  generatedContent: z.string().max(20000).optional(),
  status: sectionStatusSchema.optional(),
  consultantName: z.string().max(200).optional(),
  consultantTitle: z.string().max(200).optional(),
  consultantYearsExp: z.number().int().nonnegative().optional(),
  consultantSummary: z.string().max(8000).optional(),
});
export type UpdateJobProfileDto = z.infer<typeof updateJobProfileSchema>;

export const generateJobProfilesSchema = z.object({
  profileIds: z
    .array(z.uuid())
    .min(1, { message: 'Sélectionnez au moins une fiche' })
    .max(20),
  model: z.string().min(2).max(80).optional(),
});
export type GenerateJobProfilesDto = z.infer<typeof generateJobProfilesSchema>;

// ============================================================
// BPU / DPGF schemas
// ============================================================

export const bpuUnitSchema = z.enum(['jour', 'forfait', 'mois']);
export const bpuLineTypeSchema = z.enum(['bpu', 'dpgf']);

export const createBpuLineSchema = z.object({
  profileTitle: z.string().max(200).default(''),
  experienceLevel: z.string().max(80).default('confirme'),
  unit: bpuUnitSchema.default('jour'),
  quantity: z.number().nonnegative().default(0),
  unitPrice: z.number().nonnegative().default(0),
  tva: z.number().nonnegative().max(100).default(20),
  lineType: bpuLineTypeSchema.default('bpu'),
  phase: z.string().max(200).optional(),
  orderIndex: z.number().int().nonnegative().default(0),
});
export type CreateBpuLineDto = z.infer<typeof createBpuLineSchema>;

export const updateBpuLineSchema = createBpuLineSchema.partial();
export type UpdateBpuLineDto = z.infer<typeof updateBpuLineSchema>;

export const bulkUpsertBpuLinesSchema = z.object({
  lineType: bpuLineTypeSchema,
  /** If true, deletes all existing lines of this type before inserting */
  replace: z.boolean().default(false),
  lines: z.array(createBpuLineSchema).max(500),
});
export type BulkUpsertBpuLinesDto = z.infer<typeof bulkUpsertBpuLinesSchema>;

// ============================================================
// PricingGrid schemas
// ============================================================

export const createPricingGridSchema = z.object({
  profileTitle: z.string().min(2).max(200),
  experienceLevel: experienceLevelSchema,
  dailyRate: z.number().positive(),
  region: z.string().max(120).optional(),
  validFrom: z.iso.date().optional(),
  validTo: z.iso.date().optional(),
});
export type CreatePricingGridDto = z.infer<typeof createPricingGridSchema>;

export const updatePricingGridSchema = createPricingGridSchema.partial();
export type UpdatePricingGridDto = z.infer<typeof updatePricingGridSchema>;

// ============================================================
// ProjectDocument schemas
// ============================================================

export const documentCategorySchema = z.enum([
  'dce',
  'offre',
  'candidature',
]);
export type DocumentCategoryValue = z.infer<typeof documentCategorySchema>;

// File types — keep aligned with the React UI groupings (large catalogue)
export const documentFileTypeSchema = z.enum([
  // DCE — Pièces techniques
  'cctp',
  'ccap',
  'rc',
  'act',
  'dpgf',
  'bpu_vierge',
  // DCE — Formulaires
  'dc1',
  'dc2',
  'ae',
  'reglement',
  // Offre
  'memoire',
  'memoire_exec',
  'annexe_tech',
  'bpu_rempli',
  'dpgf_rempli',
  'offre_prix',
  // Candidature
  'dc1_signe',
  'dc2_signe',
  'ae_signe',
  'kbis',
  'rib',
  'certification',
  'assurance',
  // Communs
  'annexe',
  'autre',
]);
export type DocumentFileTypeValue = z.infer<typeof documentFileTypeSchema>;

export const uploadDocumentMetadataSchema = z.object({
  fileType: documentFileTypeSchema,
  category: documentCategorySchema,
});
export type UploadDocumentMetadataDto = z.infer<
  typeof uploadDocumentMetadataSchema
>;

export const updateDocumentSchema = z.object({
  fileType: documentFileTypeSchema.optional(),
  category: documentCategorySchema.optional(),
});
export type UpdateDocumentDto = z.infer<typeof updateDocumentSchema>;

// ============================================================
// ConsultantCv schemas
// ============================================================

const cvIdentitySchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  initials: z.string().optional(),
  role: z.string().optional(),
  subtitle: z.string().optional(),
  summary: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().optional(),
});

const cvSkillSchema = z.object({
  name: z.string(),
  level: z.number().optional(),
});

const cvLanguageSchema = z.object({
  name: z.string(),
  levelLabel: z.string().optional(),
  dots: z.number().optional(),
});

const cvCertificationSchema = z.object({
  name: z.string(),
  year: z.string().optional(),
});

const cvEducationSchema = z.object({
  degree: z.string().optional(),
  year: z.string().optional(),
  school: z.string().optional(),
});

const cvExperienceContextSchema = z.object({
  team: z.string().optional(),
  methodology: z.string().optional(),
  role: z.string().optional(),
  extraLabel: z.string().optional(),
  extraValue: z.string().optional(),
});

const cvExperienceSchema = z.object({
  role: z.string().optional(),
  company: z.string().optional(),
  clientMeta: z.string().optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  duration: z.string().optional(),
  location: z.string().optional(),
  context: cvExperienceContextSchema.optional(),
  mission: z.string().optional(),
  activities: z.array(z.object({ bold: z.string().optional(), text: z.string().optional() })).optional(),
  results: z.array(z.object({ value: z.string().optional(), label: z.string().optional() })).optional(),
  tech: z.array(z.object({ category: z.string().optional(), items: z.string().optional() })).optional(),
});

export const cvDataSchema = z
  .object({
    identity: cvIdentitySchema.optional(),
    skills: z.array(cvSkillSchema).optional(),
    tools: z.array(z.string()).optional(),
    languages: z.array(cvLanguageSchema).optional(),
    certifications: z.array(cvCertificationSchema).optional(),
    education: z.array(cvEducationSchema).optional(),
    experiences: z.array(cvExperienceSchema).optional(),
  })
  .catchall(z.unknown());
export type CvData = z.infer<typeof cvDataSchema>;
export type CvIdentityData = z.infer<typeof cvIdentitySchema>;
export type CvSkill = z.infer<typeof cvSkillSchema>;
export type CvLanguage = z.infer<typeof cvLanguageSchema>;
export type CvCertification = z.infer<typeof cvCertificationSchema>;
export type CvEducation = z.infer<typeof cvEducationSchema>;
export type CvExperience = z.infer<typeof cvExperienceSchema>;

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

export const updateConsultantCvSchema = createConsultantCvSchema.partial();
export type UpdateConsultantCvDto = z.infer<typeof updateConsultantCvSchema>;

export const formatCvFromTextSchema = z.object({
  cvText: z
    .string()
    .min(50, { message: 'Le texte du CV doit contenir au moins 50 caractères' })
    .max(50000),
  model: z.string().min(2).max(80).optional(),
  /** Persiste automatiquement le résultat en base. */
  persist: z.boolean().default(true),
});
export type FormatCvFromTextDto = z.infer<typeof formatCvFromTextSchema>;

export const adaptCvToJobSchema = z.object({
  jobProfileId: z.uuid(),
  model: z.string().min(2).max(80).optional(),
  /** Si true, lie le CV adapté à la fiche de poste cible. */
  link: z.boolean().default(false),
});
export type AdaptCvToJobDto = z.infer<typeof adaptCvToJobSchema>;

// ============================================================
// CV Import (PDF/DOCX → CvData via worker IA)
// ============================================================

export const cvImportTemplateSchema = z.enum(['modern', 'classic']);
export type CvImportTemplateValue = z.infer<typeof cvImportTemplateSchema>;

export const cvImportStatusSchema = z.enum([
  'pending',
  'processing',
  'done',
  'failed',
]);
export type CvImportStatusValue = z.infer<typeof cvImportStatusSchema>;

/**
 * DTO de la requête `POST /consultant-cvs/import-from-file`.
 * Le fichier est transmis en multipart côté HTTP — ce schéma ne valide
 * que les champs textes (templateId). Les contraintes sur le fichier
 * (taille ≤ 10 Mo, mime application/pdf | application/vnd.openxmlformats…)
 * sont appliquées par multer côté NestJS.
 */
export const cvImportFromFileSchema = z.object({
  templateId: cvImportTemplateSchema,
});
export type CvImportFromFileDto = z.infer<typeof cvImportFromFileSchema>;

/** Réponse de `GET /consultant-cvs/import-jobs/:jobId` */
export const cvImportJobSchema = z.object({
  jobId: z.uuid(),
  status: cvImportStatusSchema,
  templateId: cvImportTemplateSchema,
  inputFilename: z.string(),
  cvId: z.uuid().nullable().optional(),
  error: z.string().nullable().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CvImportJobDto = z.infer<typeof cvImportJobSchema>;

// ============================================================
// CV templates & génération PDF (nouvelle archi consultant profiles)
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

/** Body POST /consultant-cvs/:id/generate */
export const generateCvFromTemplateSchema = z.object({
  template: cvTemplateSchema,
});
export type GenerateCvFromTemplateDto = z.infer<
  typeof generateCvFromTemplateSchema
>;

/** Payload SSE — discriminated union par `kind`. */
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

/** Pagination — query params de GET /consultant-cvs */
export const consultantCvsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ConsultantCvsListQueryDto = z.infer<
  typeof consultantCvsListQuerySchema
>;

// ============================================================
// AO (BOAMP) schemas
// ============================================================

export const aoRegionSchema = z.enum([
  'IDF', 'ARA', 'BFC', 'BRE', 'CVL', 'COR',
  'GES', 'HDF', 'NOR', 'NAQ', 'OCC', 'PDL', 'PAC', 'DOM',
]);
export type AoRegionValue = z.infer<typeof aoRegionSchema>;

export const aoTypeMarcheSchema = z.enum([
  'SERVICES',
  'FOURNITURES',
  'TRAVAUX',
]);

export const aoProcedureSchema = z.enum(['OUVERT', 'NEGOCIE', 'MAPA']);

export const aoSearchQuerySchema = z.object({
  q: z.string().max(200).optional(),
  exclude: z.string().max(500).optional(),
  page: z.coerce.number().int().positive().default(1),
  region: aoRegionSchema.optional(),
  deadlineDays: z.coerce.number().int().nonnegative().default(0),
  typeMarche: aoTypeMarcheSchema.optional(),
  procedure: aoProcedureSchema.optional(),
  hidePast: z.coerce.boolean().default(true),
  hideAttrib: z.coerce.boolean().default(true),
});
export type AoSearchQueryDto = z.infer<typeof aoSearchQuerySchema>;

// AO item structure (returned by BOAMP) — used as input for analyse + favorite
export const aoItemSchema = z.object({
  id: z.string().min(1).max(80),
  source: z.string().max(40),
  title: z.string().max(2000),
  buyer: z.string().max(500).optional().nullable(),
  publishedAt: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  department: z.string().max(10).optional().nullable(),
  typeMarche: z.string().max(50).optional().nullable(),
  procedure: z.string().max(200).optional().nullable(),
  category: z.string().max(2000).optional().nullable(),
  url: z.string().max(1000).optional().nullable(),
  dceUrl: z.string().max(1000).optional().nullable(),
});
export type AoItem = z.infer<typeof aoItemSchema>;

export const analyseAoSchema = z.object({
  ao: aoItemSchema,
  rcText: z.string().max(50000).optional(),
  model: z.string().min(2).max(80).optional(),
});
export type AnalyseAoDto = z.infer<typeof analyseAoSchema>;

// ============================================================
// AoFavorite schemas
// ============================================================

export const createAoFavoriteSchema = z.object({
  aoId: z.string().min(1).max(80),
  aoData: aoItemSchema,
});
export type CreateAoFavoriteDto = z.infer<typeof createAoFavoriteSchema>;

// ============================================================
// GenerationHistory schemas
// ============================================================

export const generationModuleSchema = z.enum([
  'section',
  'fiche_poste',
  'bpu',
  'infographie',
  'cv',
  'ao_analyse',
]);
export type GenerationModuleValue = z.infer<typeof generationModuleSchema>;

export const generationHistoryQuerySchema = z.object({
  module: generationModuleSchema.optional(),
  projectId: z.uuid().optional(),
  userId: z.uuid().optional(),
  fromDate: z.iso.date().optional(),
  toDate: z.iso.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export type GenerationHistoryQueryDto = z.infer<
  typeof generationHistoryQuerySchema
>;

// ============================================================
// Dashboard schemas
// ============================================================

export const dashboardOverviewSchema = z.object({
  projectStats: z.object({
    total: z.number().int().nonnegative(),
    byStatus: z.object({
      brouillon: z.number().int().nonnegative(),
      en_cours: z.number().int().nonnegative(),
      finalise: z.number().int().nonnegative(),
      soumis: z.number().int().nonnegative(),
    }),
  }),
  tokenStats: z.object({
    totalTokens: z.number().int().nonnegative(),
    totalCost: z.number().nonnegative(),
    byModule: z.array(
      z.object({
        module: generationModuleSchema,
        count: z.number().int().nonnegative(),
        tokens: z.number().int().nonnegative(),
      }),
    ),
  }),
  recentProjects: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      clientName: z.string(),
      deadline: z.iso.date().nullable(),
      status: projectStatusSchema,
      updatedAt: z.iso.datetime(),
    }),
  ),
});
export type DashboardOverviewDto = z.infer<typeof dashboardOverviewSchema>;
