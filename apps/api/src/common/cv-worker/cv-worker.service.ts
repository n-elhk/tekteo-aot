import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import type { CvData } from '@org/schemas';

interface JobProfilePayload {
  title: string;
  experienceLevel: string;
  requiredSkills: string[];
  optionalSkills: string[];
  missions: string;
  education: string;
}

interface CvDataResponse {
  cvData: CvData;
  modelUsed: string;
  tokensUsed: number;
}

interface ProcessFromFileResponse extends CvDataResponse {
  outputPath: string;
}

@Injectable()
export class CvWorkerService {
  private readonly logger = new Logger(CvWorkerService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const baseURL = config.get<string>('CV_WORKER_URL', 'http://localhost:8000');
    this.http = axios.create({
      baseURL,
      timeout: 600_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async processFromText(cvText: string): Promise<CvDataResponse> {
    return this.post<CvDataResponse>('/process-from-text', { cvText });
  }

  async adaptToJob(
    sourceCvData: unknown,
    jobProfile: JobProfilePayload,
  ): Promise<CvDataResponse> {
    return this.post<CvDataResponse>('/adapt-to-job', {
      sourceCvData,
      jobProfile,
    });
  }

  async processFromFile(args: {
    jobId: string;
    inputPath: string;
    templateId: string;
  }): Promise<ProcessFromFileResponse> {
    return this.post<ProcessFromFileResponse>('/process-from-file', args);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    try {
      const { data } = await this.http.post<T>(path, body);
      return data;
    } catch (err) {
      this.handleError(path, err);
    }
  }

  private handleError(path: string, err: unknown): never {
    if (err instanceof AxiosError) {
      this.logger.error(
        `CV worker ${path} failed: ${err.message} (status=${err.response?.status})`,
      );
      if (err.code === 'ECONNREFUSED') {
        throw new ServiceUnavailableException(
          'Service de génération CV indisponible (worker injoignable)',
        );
      }
      if (err.code === 'ECONNABORTED') {
        throw new ServiceUnavailableException(
          'Service de génération CV indisponible (timeout LLM dépassé)',
        );
      }
      const detail =
        (err.response?.data as { detail?: string } | undefined)?.detail ??
        err.message;
      throw new BadGatewayException(`CV worker error: ${detail}`);
    }
    throw err;
  }
}
