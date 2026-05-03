"""Validation du schéma Pydantic miroir de CvData."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cv_schema import CvData


def test_empty_payload_is_valid() -> None:
    cv = CvData.model_validate({})
    assert cv.identity.firstName == ""
    assert cv.skills == []
    assert cv.experiences == []


def test_minimal_extraction() -> None:
    payload = {
        "identity": {
            "firstName": "Alice",
            "lastName": "DURAND",
            "role": "Lead Developer",
            "email": "alice@example.com",
        },
        "skills": [{"name": "Python", "level": 90}],
        "tools": ["Docker", "K8s"],
        "languages": [{"name": "Français", "levelLabel": "Natif", "dots": 5}],
        "experiences": [
            {
                "role": "Lead Dev",
                "company": "Acme",
                "dateStart": "Jan. 2022",
                "dateEnd": "Présent",
                "mission": "Conception et delivery.",
                "activities": [{"bold": "Architecture", "text": "Mise en place CI/CD"}],
            }
        ],
    }
    cv = CvData.model_validate(payload)
    assert cv.identity.firstName == "Alice"
    assert cv.skills[0].name == "Python"
    assert cv.skills[0].level == 90
    assert cv.experiences[0].activities[0].bold == "Architecture"


def test_extra_fields_are_preserved() -> None:
    """Le schéma est en `extra='allow'` — Mistral peut renvoyer des champs
    additionnels qu'on doit conserver pour ne pas perdre d'info."""
    payload = {
        "identity": {"firstName": "Bob", "customField": "value"},
        "newSection": ["foo", "bar"],
    }
    cv = CvData.model_validate(payload)
    dumped = cv.model_dump()
    assert dumped["identity"]["customField"] == "value"
    assert dumped["newSection"] == ["foo", "bar"]


def test_level_is_clamped() -> None:
    """Pydantic doit valider la borne supérieure."""
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CvData.model_validate({"skills": [{"name": "X", "level": 200}]})
