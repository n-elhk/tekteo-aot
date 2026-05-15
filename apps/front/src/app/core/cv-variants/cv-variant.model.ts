import type {
  CreateCvVariantDto,
  CvData,
  CvTemplateValue,
  UpdateCvVariantDto,
} from '@org/schemas';

export interface GeneratedCvSummary {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  filename: string | null;
  updatedAt: string;
}

export interface CvVariant {
  id: string;
  consultantId: string;
  jobProfileId: string;
  jobProfile: { id: string; title: string; projectId: string | null };
  template: CvTemplateValue;
  name: string;
  cvData: CvData;
  createdAt: string;
  updatedAt: string;
  generatedCvs: GeneratedCvSummary[];
}

export type { CreateCvVariantDto, UpdateCvVariantDto };
