/**
 * Extraction du texte brut d'un fichier PDF ou DOCX, exécutée intégralement
 * dans le navigateur (aucune dépendance backend).
 *
 * - `.pdf` est traité via `pdfjs-dist` (lazy import + worker dédié).
 * - `.docx` est traité via `mammoth` (lazy import).
 *
 * @throws {Error} Extension non supportée ou échec d'extraction (message FR).
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const extension = getExtension(file.name);

  if (extension === 'pdf') {
    return extractFromPdf(file);
  }
  if (extension === 'docx') {
    return extractFromDocx(file);
  }
  throw new Error(
    `Format non supporté : seuls les fichiers .pdf et .docx sont acceptés.`,
  );
}

function getExtension(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot === -1 ? '' : lower.slice(dot + 1);
}

async function extractFromPdf(file: File): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist');
    // pdfjs v5 nécessite un worker. On résout l'URL via `import.meta.url`
    // afin que le bundler Angular l'inclue dans le build (asset hash).
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items as Array<{ str?: string }>;
      const text = items
        .map((item) => (typeof item.str === 'string' ? item.str : ''))
        .join(' ');
      pageTexts.push(text);
    }
    return pageTexts.join('\n\n');
  } catch (error) {
    throw new Error(
      `Impossible d'extraire le texte du PDF : ${describeError(error)}`,
    );
  }
}

async function extractFromDocx(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    throw new Error(
      `Impossible d'extraire le texte du DOCX : ${describeError(error)}`,
    );
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'erreur inconnue';
}
