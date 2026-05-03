"""Worker FastAPI — pipeline CV (Mistral.rs + Docling + docxtpl).

Trois endpoints, alignés avec `apps/api/src/common/cv-worker/CvWorkerClient` :
- POST /process-from-text     (sync)  — remplace ConsultantCvsService.formatFromText
- POST /adapt-to-job          (sync)  — remplace ConsultantCvsService.adaptToJob
- POST /process-from-file     (async coté API via BullMQ) — nouveau flux PDF/DOCX
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from openai import APIConnectionError, APIError, APITimeoutError
from pydantic import BaseModel, Field, ValidationError

from cv_schema import CvData, JobProfilePayload
from docling_extractor import extract_markdown
from llm_client import call_for_cv_data
from pdf_renderer import render_cv_to_pdf
from prompts import (
    ADAPT_SYSTEM_PROMPT,
    FORMAT_SYSTEM_PROMPT,
    build_adapt_prompt,
    build_format_prompt,
)

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("cv-worker")

UPLOADS_ROOT = Path(os.environ.get("UPLOADS_ROOT", "/data/uploads"))

app = FastAPI(title="Tekteo CV worker", version="0.1.0")


# ----------------------------------------------------------------------
# Exception handlers — codes HTTP explicites et messages exploitables
# par le CvWorkerService côté NestJS.
# ----------------------------------------------------------------------


@app.exception_handler(APIConnectionError)
async def _llm_connection(request: Request, exc: APIConnectionError) -> JSONResponse:
    base = os.environ.get("LLM_BASE_URL", "?")
    detail = (
        f"LLM injoignable à {base}. Vérifie que ton serveur (Ollama / Mistral.rs / vLLM) "
        f"tourne et que LLM_BASE_URL est correct. ({exc})"
    )
    logger.error("LLM connection error: %s", detail)
    return JSONResponse(status_code=503, content={"detail": detail})


@app.exception_handler(APITimeoutError)
async def _llm_timeout(request: Request, exc: APITimeoutError) -> JSONResponse:
    logger.error("LLM timeout: %s", exc)
    return JSONResponse(
        status_code=504,
        content={"detail": "Le LLM a mis trop de temps à répondre (timeout)."},
    )


@app.exception_handler(APIError)
async def _llm_error(request: Request, exc: APIError) -> JSONResponse:
    logger.error("LLM API error: %s", exc)
    return JSONResponse(
        status_code=502,
        content={"detail": f"Le LLM a renvoyé une erreur : {exc}"},
    )


@app.exception_handler(ValidationError)
async def _validation(request: Request, exc: ValidationError) -> JSONResponse:
    logger.error("Pydantic validation failed: %s", exc)
    return JSONResponse(
        status_code=422,
        content={"detail": f"Le LLM a renvoyé un JSON invalide : {exc.errors()[:3]}"},
    )


# ----------------------------------------------------------------------
# Schemas (requêtes/réponses HTTP)
# ----------------------------------------------------------------------


class ProcessFromTextRequest(BaseModel):
    cvText: str = Field(min_length=50, max_length=50_000)


class AdaptToJobRequest(BaseModel):
    sourceCvData: dict
    jobProfile: JobProfilePayload


class ProcessFromFileRequest(BaseModel):
    jobId: str
    inputPath: str
    templateId: str = Field(pattern=r"^(modern|classic)$")


class CvDataResponse(BaseModel):
    cvData: CvData
    modelUsed: str
    tokensUsed: int


class ProcessFromFileResponse(CvDataResponse):
    outputPath: str


# ----------------------------------------------------------------------
# Endpoints
# ----------------------------------------------------------------------


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/process-from-text", response_model=CvDataResponse)
def process_from_text(payload: ProcessFromTextRequest) -> CvDataResponse:
    logger.info("process-from-text len=%d", len(payload.cvText))
    result = call_for_cv_data(
        system_prompt=FORMAT_SYSTEM_PROMPT,
        user_prompt=build_format_prompt(payload.cvText),
        max_tokens=8192,
    )
    return CvDataResponse(
        cvData=result.cv_data,
        modelUsed=result.model_used,
        tokensUsed=result.tokens_used,
    )


@app.post("/adapt-to-job", response_model=CvDataResponse)
def adapt_to_job(payload: AdaptToJobRequest) -> CvDataResponse:
    logger.info("adapt-to-job target=%r", payload.jobProfile.title)
    result = call_for_cv_data(
        system_prompt=ADAPT_SYSTEM_PROMPT,
        user_prompt=build_adapt_prompt(payload.sourceCvData, payload.jobProfile),
        max_tokens=16_000,
    )
    return CvDataResponse(
        cvData=result.cv_data,
        modelUsed=result.model_used,
        tokensUsed=result.tokens_used,
    )


@app.post("/process-from-file", response_model=ProcessFromFileResponse)
def process_from_file(payload: ProcessFromFileRequest) -> ProcessFromFileResponse:
    logger.info("process-from-file job=%s template=%s", payload.jobId, payload.templateId)

    input_path = Path(payload.inputPath)
    if not input_path.is_file():
        raise HTTPException(status_code=400, detail=f"Fichier introuvable : {payload.inputPath}")

    markdown = extract_markdown(input_path)

    result = call_for_cv_data(
        system_prompt=FORMAT_SYSTEM_PROMPT,
        user_prompt=build_format_prompt(markdown),
        max_tokens=8192,
    )

    output_dir = UPLOADS_ROOT / "cv-outputs"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{payload.jobId}.pdf"
    render_cv_to_pdf(result.cv_data, payload.templateId, output_path)

    return ProcessFromFileResponse(
        cvData=result.cv_data,
        outputPath=str(output_path),
        modelUsed=result.model_used,
        tokensUsed=result.tokens_used,
    )
