import type {
  ConsultantsListQueryDto,
  CreateConsultantDto,
  CvData,
  ImportConsultantFromTextDto,
  UpdateConsultantDto,
} from '@org/schemas';
import type { PaginatedResponse } from '@org/types';

export interface Consultant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string | null;
  yearsExperience: number | null;
  location: string | null;
  masterCvData: CvData;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; email: string; fullName: string | null } | null;
  _count?: { variants: number };
}

export type ConsultantListItem = Omit<Consultant, 'masterCvData'> & {
  _count: { variants: number };
};

export type ConsultantsList = PaginatedResponse<ConsultantListItem>;

export type {
  ConsultantsListQueryDto,
  CreateConsultantDto,
  UpdateConsultantDto,
  ImportConsultantFromTextDto,
};
