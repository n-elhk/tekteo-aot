import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { AnalyseAoDto, AoSearchQueryDto } from '@org/schemas';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseLlmJson } from '../../common/utils/llm-json.util';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import { BoampClient } from './boamp.client';
import { BraveSearchClient, type WebSnippet } from './brave-search.client';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

interface AnalysisSignal {
  level: 'red' | 'yellow' | 'green';
  text: string;
}

export interface AoAnalysisResult {
  score: number | null;
  pertinence: string;
  skillsMatch: string[];
  skillsMissing: string[];
  signals: AnalysisSignal[];
  recommendation: 'go' | 'caution' | 'nogo';
  recommendationText: string;
  boampHistory: Awaited<
    ReturnType<BoampClient['fetchAttributionHistory']>
  >;
  webSnippets: WebSnippet[];
  tokensUsed: number;
}

@Injectable()
export class AoService {
  private readonly logger = new Logger(AoService.name);

  constructor(
    private readonly boamp: BoampClient,
    private readonly anthropic: AnthropicService,
    private readonly prisma: PrismaService,
    private readonly history: GenerationHistoryService,
    private readonly brave: BraveSearchClient,
  ) {}

  async search(query: AoSearchQueryDto) {
    try {
      return await this.boamp.search({
        q: query.q,
        exclude: query.exclude,
        page: query.page,
        region: query.region,
        deadlineDays: query.deadlineDays,
        typeMarche: query.typeMarche,
        procedure: query.procedure,
        hidePast: query.hidePast,
        hideAttrib: query.hideAttrib,
      });
    } catch (error) {
      this.logger.warn(
        `Recherche BOAMP indisponible : ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      throw new BadGatewayException(
        "L'API BOAMP est temporairement indisponible. Réessayez plus tard.",
      );
    }
  }

  async analyse(
    userId: string,
    dto: AnalyseAoDto,
  ): Promise<AoAnalysisResult> {
    if (!this.anthropic.isEnabled()) {
      throw new BadRequestException(
        "Service Claude non configuré : ajoutez ANTHROPIC_API_KEY dans l'environnement",
      );
    }

    const { ao, rcText, model } = dto;

    // 1) BOAMP history
    const boampHistory = ao.buyer
      ? await this.boamp.fetchAttributionHistory(ao.buyer)
      : [];

    // 2) Brave Search — contexte web sur l'acheteur (silencieux si désactivé)
    const topTitulaire = this.dominantTitulaire(boampHistory);
    const webSnippets = await this.brave.searchBuyerContext({
      buyer: ao.buyer ?? '',
      aoTitle: ao.title,
      topTitulaire,
    });

    // 3) Pre-computed signals
    const signals = this.computeSignals(ao, boampHistory);

    // 4) TJM profiles for context
    const grids = await this.prisma.pricingGrid.findMany({
      select: { profileTitle: true },
      distinct: ['profileTitle'],
    });
    const profilesList = Array.from(
      new Set(grids.map((g) => g.profileTitle)),
    )
      .slice(0, 30)
      .join(', ');

    // 5) Global system prompt (configurable in admin)
    const globalPrompt = await this.prisma.systemPrompt.findUnique({
      where: { name: 'prompt_global' },
    });
    const systemPrompt =
      globalPrompt?.content ??
      "Tu es un expert en réponse aux appels d'offres publics informatiques en France pour une ESN.";

    const userMessage = this.buildUserMessage(
      ao,
      profilesList,
      boampHistory,
      signals,
      webSnippets,
      rcText,
    );

    const result = await this.anthropic.generate({
      systemPrompt,
      userMessage,
      model: model ?? HAIKU_MODEL,
      maxTokens: rcText ? 1500 : 900,
    });

    const parsed = parseLlmJson<{
      score?: number | null;
      pertinence?: string;
      skills_match?: string[];
      skills_missing?: string[];
      additional_signals?: AnalysisSignal[];
      recommendation?: AoAnalysisResult['recommendation'];
      recommendation_text?: string;
    }>(result.content);

    const finalResult: AoAnalysisResult = {
      score: parsed.score ?? null,
      pertinence: parsed.pertinence ?? '',
      skillsMatch: parsed.skills_match ?? [],
      skillsMissing: parsed.skills_missing ?? [],
      signals: [...signals, ...(parsed.additional_signals ?? [])],
      recommendation: parsed.recommendation ?? 'caution',
      recommendationText: parsed.recommendation_text ?? '',
      boampHistory,
      webSnippets,
      tokensUsed: result.usage.inputTokens + result.usage.outputTokens,
    };

    await this.history.record({
      module: 'ao_analyse',
      userId,
      modelUsed: result.modelUsed,
      tokensUsed: finalResult.tokensUsed,
      outputContent: JSON.stringify({
        score: finalResult.score,
        recommendation: finalResult.recommendation,
        recommendationText: finalResult.recommendationText,
      }),
      inputData: {
        aoId: ao.id,
        aoTitle: ao.title,
        buyer: ao.buyer,
        hasRcText: Boolean(rcText),
      },
    });

    return finalResult;
  }

  // --------------------------------------------------------
  private computeSignals(
    ao: AnalyseAoDto['ao'],
    boampHistory: Awaited<ReturnType<BoampClient['fetchAttributionHistory']>>,
  ): AnalysisSignal[] {
    const signals: AnalysisSignal[] = [];

    if (ao.deadline) {
      const days = Math.ceil(
        (new Date(ao.deadline).getTime() - Date.now()) / 86_400_000,
      );
      if (days >= 0 && days < 14) {
        signals.push({
          level: 'yellow',
          text: `Délai de réponse très court (${days} jour${days > 1 ? 's' : ''})`,
        });
      }
    }

    if (ao.procedure && /adapt[eé]|MAPA/i.test(ao.procedure)) {
      signals.push({
        level: 'yellow',
        text: 'Procédure adaptée (MAPA) — moins concurrentielle',
      });
    }

    if (boampHistory.length > 0) {
      const counts = this.titulaireCounts(boampHistory);
      for (const [name, count] of counts.entries()) {
        if (count >= 2) {
          signals.push({
            level: 'red',
            text: `Même titulaire "${name}" — ${count} marchés remportés chez cet acheteur`,
          });
        }
      }
    }

    return signals;
  }

  private titulaireCounts(
    boampHistory: Awaited<ReturnType<BoampClient['fetchAttributionHistory']>>,
  ): Map<string, number> {
    const counts = new Map<string, number>();
    for (const item of boampHistory) {
      if (item.titulaire) {
        counts.set(item.titulaire, (counts.get(item.titulaire) ?? 0) + 1);
      }
    }
    return counts;
  }

  /** Titulaire le plus fréquent dans l'historique BOAMP, ou `null` si aucun. */
  private dominantTitulaire(
    boampHistory: Awaited<ReturnType<BoampClient['fetchAttributionHistory']>>,
  ): string | null {
    const counts = this.titulaireCounts(boampHistory);
    let top: { name: string; count: number } | null = null;
    for (const [name, count] of counts.entries()) {
      if (!top || count > top.count) {
        top = { name, count };
      }
    }
    return top?.name ?? null;
  }

  private buildUserMessage(
    ao: AnalyseAoDto['ao'],
    profilesList: string,
    boampHistory: Awaited<ReturnType<BoampClient['fetchAttributionHistory']>>,
    signals: AnalysisSignal[],
    webSnippets: WebSnippet[],
    rcText?: string,
  ): string {
    const historyLines =
      boampHistory.length > 0
        ? boampHistory
            .slice(0, 6)
            .map(
              (h) =>
                `- ${h.date?.slice(0, 10) ?? '?'} | ${(h.objet ?? '?').slice(
                  0,
                  80,
                )} | Titulaire : ${h.titulaire ?? 'inconnu'}`,
            )
            .join('\n')
        : 'Aucun historique trouvé pour cet acheteur.';

    const signalLines =
      signals.length > 0
        ? signals.map((s) => `[${s.level}] ${s.text}`).join('\n')
        : 'Aucun signal pré-calculé.';

    const webBlock =
      webSnippets.length > 0
        ? `

## Résultats web sur l'acheteur
${webSnippets
  .map((s) => `[${s.label}] ${s.title}\n${s.description}`)
  .join('\n')}`
        : '';

    return `Analyse cet appel d'offres public informatique.

## AO
- Titre : ${ao.title}
- Acheteur : ${ao.buyer ?? 'inconnu'}
- Procédure : ${ao.procedure ?? 'inconnue'}
- Échéance : ${ao.deadline ?? 'non précisée'}
- Catégorie : ${ao.category ?? 'non précisée'}
- Département : ${ao.department ?? 'non précisé'}

## Profils disponibles chez Tekteo
${profilesList || 'non disponible'}

## Historique BOAMP de l'acheteur (marchés attribués)
${historyLines}

## Signaux pré-calculés
${signalLines}${webBlock}${
      rcText
        ? `

## Document RC / CCTP fourni
${rcText}`
        : ''
    }

Réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après, avec cette structure exacte :
{
  "score": <entier 1-10, pertinence globale pour Tekteo>,
  "pertinence": "<2-3 phrases : en quoi cet AO correspond ou non au profil Tekteo>",
  "skills_match": ["<compétence Tekteo qui correspond>"],
  "skills_missing": ["<compétence demandée mais non couverte>"],
  "additional_signals": [{"level": "red|yellow|green", "text": "<signal détecté>"}],
  "recommendation": "go|caution|nogo",
  "recommendation_text": "<1-2 phrases justifiant la recommandation>"
}`;
  }
}
