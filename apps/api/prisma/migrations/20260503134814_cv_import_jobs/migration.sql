-- CreateEnum
CREATE TYPE "CvImportStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateTable
CREATE TABLE "cv_import_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "CvImportStatus" NOT NULL DEFAULT 'pending',
    "template_id" TEXT NOT NULL,
    "input_path" TEXT NOT NULL,
    "input_filename" TEXT NOT NULL,
    "output_path" TEXT,
    "cv_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cv_import_jobs_user_id_idx" ON "cv_import_jobs"("user_id");

-- CreateIndex
CREATE INDEX "cv_import_jobs_status_idx" ON "cv_import_jobs"("status");

-- AddForeignKey
ALTER TABLE "cv_import_jobs" ADD CONSTRAINT "cv_import_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_import_jobs" ADD CONSTRAINT "cv_import_jobs_cv_id_fkey" FOREIGN KEY ("cv_id") REFERENCES "consultant_cvs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
