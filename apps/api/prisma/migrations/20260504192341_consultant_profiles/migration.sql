/*
  Warnings:

  - You are about to drop the column `cv_id` on the `cv_import_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `template_id` on the `cv_import_jobs` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `consultant_cvs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "cv_template" AS ENUM ('tekteo', 'anonyme');

-- CreateEnum
CREATE TYPE "cv_generation_status" AS ENUM ('pending', 'processing', 'success', 'failed');

-- CreateEnum
CREATE TYPE "cv_job_kind" AS ENUM ('import', 'generate');

-- DropForeignKey
ALTER TABLE "cv_import_jobs" DROP CONSTRAINT "cv_import_jobs_cv_id_fkey";

-- AlterTable
ALTER TABLE "consultant_cvs" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "cv_import_jobs" DROP COLUMN "cv_id",
DROP COLUMN "template_id",
ADD COLUMN     "consultant_id" TEXT,
ADD COLUMN     "generated_cv_id" TEXT,
ADD COLUMN     "kind" "cv_job_kind" NOT NULL DEFAULT 'import',
ADD COLUMN     "template" "cv_template" NOT NULL DEFAULT 'tekteo',
ALTER COLUMN "input_path" DROP NOT NULL,
ALTER COLUMN "input_filename" DROP NOT NULL;

-- CreateTable
CREATE TABLE "generated_cvs" (
    "id" TEXT NOT NULL,
    "consultant_id" TEXT NOT NULL,
    "template" "cv_template" NOT NULL,
    "status" "cv_generation_status" NOT NULL DEFAULT 'pending',
    "output_path" TEXT,
    "filename" TEXT,
    "error_message" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_cvs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_cvs_consultant_id_idx" ON "generated_cvs"("consultant_id");

-- CreateIndex
CREATE INDEX "generated_cvs_status_idx" ON "generated_cvs"("status");

-- CreateIndex
CREATE INDEX "cv_import_jobs_kind_idx" ON "cv_import_jobs"("kind");

-- AddForeignKey
ALTER TABLE "generated_cvs" ADD CONSTRAINT "generated_cvs_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "consultant_cvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_cvs" ADD CONSTRAINT "generated_cvs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_import_jobs" ADD CONSTRAINT "cv_import_jobs_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "consultant_cvs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_import_jobs" ADD CONSTRAINT "cv_import_jobs_generated_cv_id_fkey" FOREIGN KEY ("generated_cv_id") REFERENCES "generated_cvs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
