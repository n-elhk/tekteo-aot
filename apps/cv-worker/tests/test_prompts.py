"""Vérifie que les builders de prompt produisent un texte non vide
avec les éléments-clés de la fiche de poste injectés."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cv_schema import JobProfilePayload
from prompts import build_adapt_prompt, build_format_prompt


def test_format_prompt_contains_cv_text() -> None:
    text = "Alice Durand — Senior Dev Python depuis 2018."
    prompt = build_format_prompt(text)
    assert text in prompt
    assert "JSON" in prompt


def test_adapt_prompt_uses_job_profile_fields() -> None:
    job = JobProfilePayload(
        title="Tech Lead Cloud",
        experienceLevel="senior",
        requiredSkills=["AWS", "Terraform"],
        optionalSkills=["GCP"],
        missions="Diriger l'équipe infra.",
        education="Bac+5 informatique",
    )
    prompt = build_adapt_prompt({"identity": {"role": "Dev"}}, job)
    assert "Tech Lead Cloud" in prompt
    assert "senior" in prompt
    assert "AWS" in prompt
    assert "Terraform" in prompt
    assert "GCP" in prompt
    assert "Bac+5" in prompt
