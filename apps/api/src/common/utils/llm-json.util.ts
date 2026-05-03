/**
 * Utilities to safely extract and repair JSON returned by LLMs.
 * LLMs frequently produce slightly invalid JSON (trailing commas,
 * raw newlines inside string literals, markdown wrappers, etc.).
 */

/**
 * Best-effort repair of common JSON issues produced by LLMs.
 */
export function repairLlmJson(input: string): string {
  return (
    input
      // Trailing commas before } or ]
      .replace(/,(\s*[}\]])/g, '$1')
      // Double commas
      .replace(/,(\s*,)+/g, ',')
      // Raw line breaks inside JSON string literals
      .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) =>
        match
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t'),
      )
  );
}

/**
 * Extracts the first balanced JSON object from a raw LLM response,
 * stripping any surrounding markdown fences, then parses it.
 *
 * @throws if no JSON object can be parsed.
 */
export function parseLlmJson<T = unknown>(raw: string): T {
  // Remove leading ```json / ``` and trailing ```
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Aucun objet JSON détecté dans la réponse');
  }

  const candidate = match[0];

  try {
    return JSON.parse(repairLlmJson(candidate)) as T;
  } catch (firstError) {
    // Last-resort: maybe the JSON is truncated mid-value
    const truncated = candidate.replace(/,?\s*$/, '') + '}';
    try {
      return JSON.parse(repairLlmJson(truncated)) as T;
    } catch {
      throw new Error(
        `JSON invalide : ${
          firstError instanceof Error ? firstError.message : 'erreur inconnue'
        }`,
      );
    }
  }
}
