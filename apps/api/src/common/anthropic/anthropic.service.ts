import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const ALLOWED_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
] as const;

const DEFAULT_MODEL: AllowedModel = 'claude-sonnet-4-6';

export type AllowedModel = (typeof ALLOWED_MODELS)[number];

export interface ClaudeAttachment {
  name: string;
  mediaType: 'application/pdf' | 'text/plain';
  /** base64 for PDF, raw text for text/plain */
  data: string;
}

export interface ClaudeGenerateInput {
  systemPrompt?: string;
  userMessage: string;
  maxTokens?: number;
  model?: string;
  attachments?: ClaudeAttachment[];
}

export interface ClaudeGenerateResult {
  content: string;
  modelUsed: AllowedModel;
  usage: { inputTokens: number; outputTokens: number };
}

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);
  private readonly client: Anthropic | null;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        '⚠️  ANTHROPIC_API_KEY non configurée — la génération IA est désactivée',
      );
      this.client = null;
    } else {
      this.client = new Anthropic({ apiKey });
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  private resolveModel(model?: string): AllowedModel {
    if (model && (ALLOWED_MODELS as readonly string[]).includes(model)) {
      return model as AllowedModel;
    }
    return DEFAULT_MODEL;
  }

  async generate(input: ClaudeGenerateInput): Promise<ClaudeGenerateResult> {
    if (!this.client) {
      throw new InternalServerErrorException(
        'Service Anthropic non configuré (ANTHROPIC_API_KEY manquante)',
      );
    }

    const model = this.resolveModel(input.model);
    const maxTokens = input.maxTokens ?? 4096;

    const userContent: Anthropic.MessageParam['content'] = [
      { type: 'text', text: input.userMessage },
    ];

    for (const attachment of input.attachments ?? []) {
      if (attachment.mediaType === 'application/pdf') {
        userContent.push({
          type: 'document',
          title: attachment.name,
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: attachment.data,
          },
        });
      } else {
        userContent.push({
          type: 'document',
          title: attachment.name,
          source: { type: 'text', media_type: 'text/plain', data: attachment.data },
        });
      }
    }

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        system: input.systemPrompt ?? undefined,
        messages: [{ role: 'user', content: userContent }],
      });

      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );

      return {
        content: textBlock?.text ?? '',
        modelUsed: model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      this.logger.error('Erreur API Anthropic', error);
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Erreur API Anthropic',
      );
    }
  }
}
