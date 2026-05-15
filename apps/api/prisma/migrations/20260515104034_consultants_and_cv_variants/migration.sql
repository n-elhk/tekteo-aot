/*
  Warnings:

  - You are about to drop the column `consultant_id` on the `generated_cvs` table. All the data in the column will be lost.
  - You are about to drop the column `template` on the `generated_cvs` table. All the data in the column will be lost.
  - You are about to drop the column `consultant_name` on the `job_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `consultant_summary` on the `job_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `consultant_title` on the `job_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `consultant_years_exp` on the `job_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `cv_id` on the `job_profiles` table. All the data in the column will be lost.
  - You are about to drop the `consultant_cvs` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `variant_id` to the `generated_cvs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "consultant_cvs" DROP CONSTRAINT "consultant_cvs_created_by_fkey";

-- DropForeignKey
ALTER TABLE "cv_import_jobs" DROP CONSTRAINT "cv_import_jobs_consultant_id_fkey";

-- DropForeignKey
ALTER TABLE "generated_cvs" DROP CONSTRAINT "generated_cvs_consultant_id_fkey";

-- DropForeignKey
ALTER TABLE "job_profiles" DROP CONSTRAINT "job_profiles_cv_id_fkey";

-- DropIndex
DROP INDEX "generated_cvs_consultant_id_idx";

-- AlterTable
ALTER TABLE "generated_cvs" DROP COLUMN "consultant_id",
DROP COLUMN "template",
ADD COLUMN     "variant_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "job_profiles" DROP COLUMN "consultant_name",
DROP COLUMN "consultant_summary",
DROP COLUMN "consultant_title",
DROP COLUMN "consultant_years_exp",
DROP COLUMN "cv_id";

-- DropTable
DROP TABLE "consultant_cvs";

-- CreateTable
CREATE TABLE "consultants" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "years_experience" INTEGER,
    "location" TEXT,
    "master_cv_data" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_variants" (
    "id" TEXT NOT NULL,
    "consultant_id" TEXT NOT NULL,
    "job_profile_id" TEXT NOT NULL,
    "template" "cv_template" NOT NULL,
    "name" TEXT NOT NULL,
    "cv_data" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultants_email_key" ON "consultants"("email");

-- CreateIndex
CREATE INDEX "cv_variants_consultant_id_idx" ON "cv_variants"("consultant_id");

-- CreateIndex
CREATE INDEX "cv_variants_job_profile_id_idx" ON "cv_variants"("job_profile_id");

-- CreateIndex
CREATE INDEX "generated_cvs_variant_id_idx" ON "generated_cvs"("variant_id");

-- AddForeignKey
ALTER TABLE "generated_cvs" ADD CONSTRAINT "generated_cvs_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "cv_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_import_jobs" ADD CONSTRAINT "cv_import_jobs_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "consultants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultants" ADD CONSTRAINT "consultants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_variants" ADD CONSTRAINT "cv_variants_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "consultants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_variants" ADD CONSTRAINT "cv_variants_job_profile_id_fkey" FOREIGN KEY ("job_profile_id") REFERENCES "job_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_variants" ADD CONSTRAINT "cv_variants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
