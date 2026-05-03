-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'redacteur', 'lecteur');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('brouillon', 'en_cours', 'finalise', 'soumis');

-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('brouillon', 'valide');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('junior', 'confirme', 'senior', 'expert');

-- CreateEnum
CREATE TYPE "BpuUnit" AS ENUM ('jour', 'forfait', 'mois');

-- CreateEnum
CREATE TYPE "BpuLineType" AS ENUM ('bpu', 'dpgf');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('dce', 'offre', 'candidature');

-- CreateEnum
CREATE TYPE "GenerationModule" AS ENUM ('section', 'fiche_poste', 'bpu', 'infographie', 'cv', 'ao_analyse');

-- CreateEnum
CREATE TYPE "RemunerationType" AS ENUM ('freelance', 'cdi', 'les_deux');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "full_name" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'redacteur';

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "market_reference" TEXT,
    "market_object" TEXT,
    "deadline" DATE,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duration_months" INTEGER,
    "lots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ProjectStatus" NOT NULL DEFAULT 'brouillon',
    "source_ao_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt_template" TEXT NOT NULL,
    "default_content" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "template_id" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "status" "SectionStatus" NOT NULL DEFAULT 'brouillon',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_prompts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_history" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "module" "GenerationModule" NOT NULL,
    "input_data" JSONB,
    "output_content" TEXT,
    "model_used" TEXT,
    "tokens_used" INTEGER,
    "generated_by" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_profiles" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT NOT NULL,
    "experience_level" "ExperienceLevel" NOT NULL,
    "required_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "optional_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missions" TEXT NOT NULL DEFAULT '',
    "education" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "generated_content" TEXT NOT NULL DEFAULT '',
    "status" "SectionStatus" NOT NULL DEFAULT 'brouillon',
    "boondmanager_url" TEXT,
    "consultant_name" TEXT,
    "consultant_title" TEXT,
    "consultant_years_exp" INTEGER,
    "consultant_summary" TEXT,
    "reference" TEXT,
    "market_context" TEXT,
    "mission_type" TEXT,
    "duration" TEXT,
    "remote_work" TEXT,
    "start_date" TEXT,
    "consultant_status" TEXT,
    "client_sector" TEXT,
    "specific_requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tjm_low" TEXT,
    "tjm_high" TEXT,
    "tjm_recommended" TEXT,
    "salary_low" TEXT,
    "salary_high" TEXT,
    "salary_recommended" TEXT,
    "salary_warning" TEXT,
    "quantity_needed" INTEGER NOT NULL DEFAULT 1,
    "remuneration_type" "RemunerationType",
    "cv_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_grids" (
    "id" TEXT NOT NULL,
    "profile_title" TEXT NOT NULL,
    "experience_level" "ExperienceLevel" NOT NULL,
    "daily_rate" DECIMAL(10,2) NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'Île-de-France',
    "valid_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_grids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bpu_lines" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "profile_title" TEXT NOT NULL,
    "experience_level" TEXT NOT NULL,
    "unit" "BpuUnit" NOT NULL DEFAULT 'jour',
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "line_type" "BpuLineType" NOT NULL DEFAULT 'bpu',
    "phase" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bpu_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_documents" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'dce',
    "storage_path" TEXT NOT NULL,
    "file_size" INTEGER,
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultant_cvs" (
    "id" TEXT NOT NULL,
    "cv_data" JSONB NOT NULL,
    "consultant_name" TEXT,
    "consultant_title" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultant_cvs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ao_favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ao_id" TEXT NOT NULL,
    "ao_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ao_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sections_project_id_idx" ON "sections"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_prompts_name_key" ON "system_prompts"("name");

-- CreateIndex
CREATE INDEX "generation_history_project_id_idx" ON "generation_history"("project_id");

-- CreateIndex
CREATE INDEX "generation_history_generated_by_idx" ON "generation_history"("generated_by");

-- CreateIndex
CREATE INDEX "job_profiles_project_id_idx" ON "job_profiles"("project_id");

-- CreateIndex
CREATE INDEX "bpu_lines_project_id_idx" ON "bpu_lines"("project_id");

-- CreateIndex
CREATE INDEX "project_documents_project_id_idx" ON "project_documents"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "ao_favorites_user_id_ao_id_key" ON "ao_favorites"("user_id", "ao_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_templates" ADD CONSTRAINT "section_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "section_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_prompts" ADD CONSTRAINT "system_prompts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_history" ADD CONSTRAINT "generation_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_history" ADD CONSTRAINT "generation_history_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_profiles" ADD CONSTRAINT "job_profiles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_profiles" ADD CONSTRAINT "job_profiles_cv_id_fkey" FOREIGN KEY ("cv_id") REFERENCES "consultant_cvs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bpu_lines" ADD CONSTRAINT "bpu_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_cvs" ADD CONSTRAINT "consultant_cvs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ao_favorites" ADD CONSTRAINT "ao_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
