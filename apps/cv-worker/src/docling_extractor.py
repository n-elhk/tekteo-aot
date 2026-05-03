"""Extraction PDF/DOCX → Markdown via Docling.

Docling gère nativement la lecture PDF (avec OCR si nécessaire) et DOCX.
Le résultat Markdown est ensuite injecté tel quel dans le prompt Mistral.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from docling.document_converter import DocumentConverter

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _converter() -> DocumentConverter:
    """Le converter charge des modèles à la 1ʳᵉ instanciation —
    on le mémoïse pour ne payer ce coût qu'une fois par process."""
    return DocumentConverter()


def extract_markdown(input_path: str | Path) -> str:
    path = Path(input_path)
    if not path.is_file():
        raise FileNotFoundError(f"Fichier introuvable : {path}")

    logger.info("Docling: extraction de %s (%d bytes)", path.name, path.stat().st_size)
    result = _converter().convert(str(path))
    markdown = result.document.export_to_markdown()
    if not markdown.strip():
        raise ValueError("Docling n'a pas pu extraire de texte du document")
    logger.info("Docling: %d chars extraits", len(markdown))
    return markdown
