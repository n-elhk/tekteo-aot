/**
 * BOAMP (Bulletin Officiel des Annonces des Marchés Publics) — client API.
 * Wraps the public OpenDataSoft endpoint with the IT-only filter and our
 * domain-specific helpers.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { AoItem } from '@org/schemas';
import type { PaginatedResponse } from '@org/types';

const BASE_URL =
  'https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records';

const IT_DESCRIPTORS = [
  'Informatique',
  'Logiciel',
  'Progiciel',
  'Télécommunications',
  'Système information',
  'Hébergement',
  'Cybersécurité',
  'Numérique',
] as const;

export const REGIONS: Record<string, string[]> = {
  IDF: ['75', '77', '78', '91', '92', '93', '94', '95'],
  ARA: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  BFC: ['21', '25', '39', '58', '70', '71', '89', '90'],
  BRE: ['22', '29', '35', '56'],
  CVL: ['18', '28', '36', '37', '41', '45'],
  COR: ['2A', '2B'],
  GES: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
  HDF: ['02', '59', '60', '62', '80'],
  NOR: ['14', '27', '50', '61', '76'],
  NAQ: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
  OCC: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
  PDL: ['44', '49', '53', '72', '85'],
  PAC: ['04', '05', '06', '13', '83', '84'],
  DOM: ['971', '972', '973', '974', '976'],
};

export interface BoampSearchInput {
  q?: string;
  exclude?: string;
  page: number;
  region?: string;
  deadlineDays: number;
  typeMarche?: string;
  procedure?: string;
  hidePast: boolean;
  hideAttrib: boolean;
}

/** Page de recherche BOAMP (pagination fixée à 20 par défaut). */
export type BoampSearchResult = PaginatedResponse<AoItem>;

const BOAMP_PAGE_SIZE = 20;

export interface BoampHistoryItem {
  date: string | null;
  objet: string | null;
  titulaire: string | null;
  acheteur: string | null;
}

@Injectable()
export class BoampClient {
  private readonly logger = new Logger(BoampClient.name);

  async search(input: BoampSearchInput): Promise<BoampSearchResult> {
    const offset = (input.page - 1) * BOAMP_PAGE_SIZE;
    const clauses = this.buildSearchClauses(input);

    let response = await this.fetchBoamp(clauses, offset);

    // 400 → retry without "famille" filter (not always available depending on dataset version)
    if (response.status === 400) {
      const fallbackClauses = clauses.filter(
        (clause) => !clause.includes('famille'),
      );
      response = await this.fetchBoamp(fallbackClauses, offset);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `BOAMP ${response.status}: ${body.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as {
      results?: BoampRecord[];
      total_count?: number;
    };

    return {
      items: (data.results ?? []).map(this.mapRecord),
      page: input.page,
      pageSize: BOAMP_PAGE_SIZE,
      total: data.total_count ?? 0,
    };
  }

  async fetchAttributionHistory(buyer: string): Promise<BoampHistoryItem[]> {
    const buyerClean = buyer.replace(/["%\\]/g, '').trim().slice(0, 60);
    if (!buyerClean) return [];

    try {
      const params = new URLSearchParams({
        where: `famille like "%ATTRIBUTION%" AND nomacheteur like "%${buyerClean}%"`,
        select: 'objet,dateparution,donnees,nomacheteur',
        order_by: 'dateparution DESC',
        limit: '10',
      });
      const response = await fetch(`${BASE_URL}?${params}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return [];

      const data = (await response.json()) as { results?: BoampRecord[] };
      return (data.results ?? []).map((row) => ({
        date: row.dateparution ?? null,
        objet: row.objet ?? null,
        titulaire: extractTitulaireName(row.donnees),
        acheteur: row.nomacheteur ?? null,
      }));
    } catch (error) {
      this.logger.warn(
        `Impossible de récupérer l'historique BOAMP : ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return [];
    }
  }

  // --------------------------------------------------------
  private buildSearchClauses(input: BoampSearchInput): string[] {
    const clauses: string[] = [];

    // IT filter
    clauses.push(
      `(${IT_DESCRIPTORS.map(
        (term) => `descripteur_libelle like "%${term}%"`,
      ).join(' OR ')})`,
    );

    if (input.q) {
      const safe = input.q.replace(/["%]/g, '');
      clauses.push(`objet like "%${safe}%"`);
    }

    if (input.exclude) {
      const keywords = input.exclude
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const kw of keywords) {
        clauses.push(`objet not like "%${kw.replace(/["%]/g, '')}%"`);
      }
    }

    if (input.region && REGIONS[input.region]) {
      const departments = REGIONS[input.region]
        .map((dept) => `"${dept}"`)
        .join(',');
      clauses.push(`code_departement in (${departments})`);
    }

    if (input.typeMarche) {
      clauses.push(`type_marche_facette like "%${input.typeMarche}%"`);
    }

    if (input.procedure === 'MAPA') {
      clauses.push(
        '(type_procedure = "PROCEDURE_ADAPTE" OR perimetre = "MAPA" OR perimetre = "FNSimple")',
      );
    } else if (input.procedure) {
      clauses.push(`type_procedure = "${input.procedure}"`);
    }

    if (input.hidePast) {
      const today = new Date().toISOString().slice(0, 10);
      clauses.push(`datelimitereponse >= "${today}"`);
    }

    if (input.deadlineDays > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const limit = new Date(Date.now() + input.deadlineDays * 86_400_000)
        .toISOString()
        .slice(0, 10);
      clauses.push(
        `datelimitereponse >= "${today}" AND datelimitereponse <= "${limit}"`,
      );
    }

    if (input.hideAttrib) {
      clauses.push('famille not like "%ATTRIBUTION%"');
    }

    return clauses;
  }

  private fetchBoamp(clauses: string[], offset: number): Promise<Response> {
    const params = new URLSearchParams({
      where: clauses.join(' AND '),
      limit: String(BOAMP_PAGE_SIZE),
      offset: offset.toString(),
      order_by: 'dateparution DESC',
      select:
        'idweb,objet,nomacheteur,dateparution,datelimitereponse,descripteur_libelle,code_departement,type_marche_facette,procedure_libelle,url_avis,donnees',
    });
    return fetch(`${BASE_URL}?${params}`, {
      headers: { Accept: 'application/json' },
    });
  }

  private mapRecord = (row: BoampRecord): AoItem => ({
    id: `boamp-${row.idweb ?? ''}`,
    source: 'BOAMP',
    title: row.objet ?? '(sans titre)',
    buyer: row.nomacheteur ?? null,
    publishedAt: row.dateparution ?? null,
    deadline: row.datelimitereponse ?? null,
    department: row.code_departement != null ? String(row.code_departement) : null,
    typeMarche: Array.isArray(row.type_marche_facette)
      ? row.type_marche_facette[0]
      : null,
    procedure: row.procedure_libelle ?? null,
    category: Array.isArray(row.descripteur_libelle)
      ? row.descripteur_libelle.join(', ')
      : (row.descripteur_libelle ?? 'Informatique'),
    url:
      row.url_avis ??
      `https://www.boamp.fr/pages/avis/?q=idweb:${row.idweb ?? ''}`,
    dceUrl: extractDceUrl(row.donnees),
  });
}

// ----------------------------------------------------------
// Types & helpers
// ----------------------------------------------------------

interface BoampRecord {
  idweb?: string;
  objet?: string;
  nomacheteur?: string;
  dateparution?: string;
  datelimitereponse?: string;
  descripteur_libelle?: string | string[];
  code_departement?: string | number;
  type_marche_facette?: string | string[];
  procedure_libelle?: string;
  url_avis?: string;
  donnees?: unknown;
}

function extractDceUrl(donnees: unknown): string | null {
  if (!donnees) return null;
  let data: unknown = donnees;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  return findUrlRecursive(data);
}

function findUrlRecursive(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = findUrlRecursive(item);
      if (result) return result;
    }
    return null;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (
      (key === 'cbc:EndpointID' || key === 'cbc:URI') &&
      typeof value === 'string' &&
      value.startsWith('http')
    ) {
      return value;
    }
    if (typeof value === 'object') {
      const result = findUrlRecursive(value);
      if (result) return result;
    }
  }
  return null;
}

function extractTitulaireName(
  donnees: unknown,
  depth = 0,
): string | null {
  if (!donnees || depth > 12) return null;
  let data: unknown = donnees;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof data !== 'object' || data === null) return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const result = extractTitulaireName(item, depth + 1);
      if (result) return result;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;
  for (const key of ['TITULAIRE', 'titulaire', 'Titulaire']) {
    const value = obj[key];
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const result = extractTitulaireName(value, depth + 1);
      if (result) return result;
    }
  }
  if (obj['cac:TendererParty']) {
    const result = extractTitulaireName(obj['cac:TendererParty'], depth + 1);
    if (result) return result;
  }
  if (obj['cac:PartyName']) {
    const result = extractTitulaireName(obj['cac:PartyName'], depth + 1);
    if (result) return result;
  }
  if (typeof obj['cbc:Name'] === 'string') return obj['cbc:Name'];

  for (const value of Object.values(obj)) {
    if (typeof value === 'object') {
      const result = extractTitulaireName(value, depth + 1);
      if (result) return result;
    }
  }
  return null;
}
