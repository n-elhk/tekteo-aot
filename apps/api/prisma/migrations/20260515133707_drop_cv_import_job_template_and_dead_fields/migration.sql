/*
  Warnings:

  - You are about to drop the column `generated_cv_id` on the `cv_import_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `kind` on the `cv_import_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `output_path` on the `cv_import_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `template` on the `cv_import_jobs` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "cv_import_jobs" DROP CONSTRAINT "cv_import_jobs_generated_cv_id_fkey";

-- DropIndex
DROP INDEX "cv_import_jobs_kind_idx";

-- AlterTable
ALTER TABLE "cv_import_jobs" DROP COLUMN "generated_cv_id",
DROP COLUMN "kind",
DROP COLUMN "output_path",
DROP COLUMN "template";

-- DropEnum
DROP TYPE "cv_job_kind";
