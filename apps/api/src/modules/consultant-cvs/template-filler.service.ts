import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type { CvData, CvTemplateValue } from '@org/schemas';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import {
  FILL_TEMPLATE_SYSTEM_PROMPT,
  buildFillTemplatePrompt,
} from './cv-template-prompts';

const TEMPLATE_FILES: Record<CvTemplateValue, string> = {
  tekteo: 'cv_template_tekteo.html',
  anonyme: 'cv_template_anonyme.html',
};

const TEMPLATES_DIR = resolve('apps/api/templates');

interface FillResult {
  html: string;
  modelUsed: string;
  tokensUsed: number;
}

/**
 * Remplit un template HTML de CV via Claude.
 * Met le template en cache mémoire (lecture une seule fois).
 */
@Injectable()
export class TemplateFillerService {
  private readonly logger = new Logger(TemplateFillerService.name);
  private readonly templateCache = new Map<CvTemplateValue, string>();

  constructor(private readonly anthropic: AnthropicService) {}

  async fill(cvData: CvData, template: CvTemplateValue): Promise<FillResult> {
    const templateHtml = await this.getTemplate(template);

    const systemWithTemplate = `${FILL_TEMPLATE_SYSTEM_PROMPT}

Voici le template HTML à utiliser :

${templateHtml}`;

    const generation = await this.anthropic.generate({
      systemPrompt: systemWithTemplate,
      userMessage: buildFillTemplatePrompt(cvData),
      maxTokens: 16_000,
    });

    const html = stripCodeFences(generation.content);
    if (!html.toLowerCase().includes('<html')) {
      throw new Error(
        'template_fill_failed: la réponse de Claude ne contient pas de HTML valide',
      );
    }

    return {
      html,
      modelUsed: generation.modelUsed,
      tokensUsed:
        generation.usage.inputTokens + generation.usage.outputTokens,
    };
  }

  private async getTemplate(template: CvTemplateValue): Promise<string> {
    const cached = this.templateCache.get(template);
    if (cached) return cached;
    const path = join(TEMPLATES_DIR, TEMPLATE_FILES[template]);
    const content = await readFile(path, 'utf-8');
    this.templateCache.set(template, content);
    this.logger.log(`📄 Template "${template}" chargé (${content.length} chars)`);
    return content;
  }
}

function stripCodeFences(text: string): string {
  let trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:html)?\n/, '').replace(/```\s*$/, '');
  }
  return trimmed.trim();
}
