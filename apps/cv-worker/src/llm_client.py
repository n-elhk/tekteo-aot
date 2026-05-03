"""Client LLM — wrapper minimal autour du SDK OpenAI.

Le runtime cible est Mistral.rs (`LLM_BASE_URL=http://mistralrs:1234/v1`),
mais l'API étant OpenAI-compatible, le même code marche pour Ollama,
vLLM, llama.cpp/llama-server, TGI, etc.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass

from openai import OpenAI
from openai.types.chat import ChatCompletion
from pydantic import ValidationError

from cv_schema import CvData

logger = logging.getLogger(__name__)


@dataclass
class LlmResult:
    cv_data: CvData
    model_used: str
    tokens_used: int


_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            base_url=os.environ["LLM_BASE_URL"],
            api_key=os.environ.get("LLM_API_KEY", "not-needed"),
        )
    return _client


def _model() -> str:
    return os.environ.get("LLM_MODEL", "mistral")


def _num_ctx() -> int:
    return int(os.environ.get("LLM_NUM_CTX", "8192"))


def _extract_usage(resp: ChatCompletion) -> int:
    if resp.usage is None:
        return 0
    return (resp.usage.prompt_tokens or 0) + (resp.usage.completion_tokens or 0)


def call_for_cv_data(
    *,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 8192,
    retry_on_parse_error: bool = True,
) -> LlmResult:
    """Appelle le LLM en mode JSON et valide la réponse contre `CvData`.

    Stratégie :
    - 1ʳᵉ passe : `response_format={"type": "json_object"}` (souple, supporté
      par tous les runtimes OpenAI-compat).
    - Si la validation Pydantic échoue, 1 retry avec un rappel explicite
      du format attendu.
    """
    client = _get_client()
    model = _model()

    def _request(extra_user: str = "") -> ChatCompletion:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt + extra_user},
        ]
        return client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
            temperature=0.2,
            extra_body={"options": {"num_ctx": _num_ctx()}},
        )

    response = _request()
    raw = response.choices[0].message.content or ""

    try:
        cv_data = CvData.model_validate_json(raw)
    except (ValidationError, json.JSONDecodeError) as exc:
        if not retry_on_parse_error:
            raise
        logger.warning("LLM JSON parse failed, retrying once: %s", exc)
        response = _request(
            "\n\nIMPORTANT : ta dernière réponse n'était pas un JSON valide. "
            "Réponds STRICTEMENT par un objet JSON, sans aucun texte additionnel, "
            "sans markdown."
        )
        raw = response.choices[0].message.content or ""
        cv_data = CvData.model_validate_json(raw)

    return LlmResult(
        cv_data=cv_data,
        model_used=response.model or model,
        tokens_used=_extract_usage(response),
    )
