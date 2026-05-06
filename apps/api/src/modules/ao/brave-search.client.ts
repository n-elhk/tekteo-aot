/**
 * Brave Search client — recherche web ciblée sur l'acheteur d'un AO.
 *
 * Construit deux requêtes complémentaires pour enrichir l'analyse IA :
 *   - relation acheteur / titulaire historique (si dispo) ;
 *   - attributions similaires (mots-clés du titre + "avis d'attribution").
 *
 * Échec silencieux : toute erreur réseau ou clé manquante renvoie `[]`.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const REQUEST_TIMEOUT_MS = 8_000;
const RESULTS_PER_QUERY = 4;
const TITULAIRE_MAX_LENGTH = 50;
const KEYWORDS_TAKE = 4;
const KEYWORD_MIN_LENGTH = 4;

const STOP_WORDS = new Set([
  'pour',
  'avec',
  'dans',
  'de',
  'du',
  'des',
  'les',
  'une',
  'par',
  'sur',
  'aux',
  'et',
  'ou',
]);

export interface WebSnippet {
  type: 'titulaire' | 'attribution';
  label: string;
  title: string;
  url: string;
  description: string;
}

interface SearchDescriptor {
  type: WebSnippet['type'];
  label: string;
  q: string;
}

interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
    }>;
  };
}

@Injectable()
export class BraveSearchClient {
  private readonly logger = new Logger(BraveSearchClient.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return Boolean(this.config.get<string>('BRAVE_SEARCH_API_KEY'));
  }

  async searchBuyerContext(input: {
    buyer: string;
    aoTitle: string;
    topTitulaire: string | null;
  }): Promise<WebSnippet[]> {
    const apiKey = this.config.get<string>('BRAVE_SEARCH_API_KEY');
    if (!apiKey) return [];

    const buyerQ = (input.buyer ?? '').replace(/["%]/g, '').trim();
    if (!buyerQ) return [];

    try {
      const searches = this.buildSearches(buyerQ, input.aoTitle, input.topTitulaire);
      const settled = await Promise.allSettled(
        searches.map((s) => this.runSearch(s, apiKey)),
      );

      const seen = new Set<string>();
      const merged: WebSnippet[] = [];
      for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue;
        for (const snippet of outcome.value) {
          if (!snippet.url || seen.has(snippet.url)) continue;
          seen.add(snippet.url);
          merged.push(snippet);
        }
      }
      return merged;
    } catch (error) {
      this.logger.warn(
        `Brave Search error: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return [];
    }
  }

  // --------------------------------------------------------
  private buildSearches(
    buyerQ: string,
    aoTitle: string,
    topTitulaire: string | null,
  ): SearchDescriptor[] {
    const searches: SearchDescriptor[] = [];

    if (topTitulaire) {
      const titulaireSafe = topTitulaire
        .replace(/["%]/g, '')
        .trim()
        .slice(0, TITULAIRE_MAX_LENGTH);
      if (titulaireSafe) {
        searches.push({
          type: 'titulaire',
          label: 'Relation acheteur / titulaire',
          q: `"${buyerQ}" "${titulaireSafe}"`,
        });
      }
    }

    const keywords = extractKeywords(aoTitle);
    searches.push({
      type: 'attribution',
      label: 'Attributions similaires',
      q: `"${buyerQ}" "avis d'attribution" ${keywords}`.trim(),
    });

    return searches;
  }

  private async runSearch(
    search: SearchDescriptor,
    apiKey: string,
  ): Promise<WebSnippet[]> {
    const params = new URLSearchParams({
      q: search.q,
      count: String(RESULTS_PER_QUERY),
      lang: 'fr',
      country: 'FR',
      text_decorations: 'false',
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${BRAVE_ENDPOINT}?${params}`, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn(
          `Brave Search HTTP ${response.status} on "${search.type}"`,
        );
        return [];
      }
      const data = (await response.json()) as BraveSearchResponse;
      return (data.web?.results ?? []).map((row) => ({
        type: search.type,
        label: search.label,
        title: row.title ?? '',
        url: row.url ?? '',
        description: row.description ?? '',
      }));
    } catch (error) {
      this.logger.warn(
        `Brave Search error on "${search.type}": ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractKeywords(aoTitle: string): string {
  return (aoTitle ?? '')
    .replace(/[^\wÀ-ÿ\s]/gi, ' ')
    .split(/\s+/)
    .filter(
      (w) => w.length > KEYWORD_MIN_LENGTH && !STOP_WORDS.has(w.toLowerCase()),
    )
    .slice(0, KEYWORDS_TAKE)
    .join(' ');
}
