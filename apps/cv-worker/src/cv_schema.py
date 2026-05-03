"""Pydantic miroir du `CvData` partagé (libs/shared/schemas).

Volontairement permissif : Mistral peut produire des champs
légèrement variables et l'éditeur front laisse l'utilisateur ajuster.
On garde la forme du squelette stricte pour le routage, et `extra='allow'`
pour ne pas perdre d'informations utiles.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class _Loose(BaseModel):
    model_config = ConfigDict(extra="allow")


class Identity(_Loose):
    firstName: str = ""
    lastName: str = ""
    initials: str = ""
    role: str = ""
    subtitle: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""


class Skill(_Loose):
    name: str
    level: int = Field(default=70, ge=0, le=100)


class Language(_Loose):
    name: str
    levelLabel: str = ""
    dots: int = Field(default=3, ge=1, le=5)


class Certification(_Loose):
    name: str
    year: str = ""


class Education(_Loose):
    degree: str
    year: str = ""
    school: str = ""


class ExperienceContext(_Loose):
    team: str = ""
    methodology: str = ""
    role: str = ""
    extraLabel: str = ""
    extraValue: str = ""


class ExperienceActivity(_Loose):
    bold: str = ""
    text: str = ""


class ExperienceResult(_Loose):
    value: str = ""
    label: str = ""


class ExperienceTech(_Loose):
    category: str = ""
    items: str = ""


class Experience(_Loose):
    role: str = ""
    company: str = ""
    clientMeta: str = ""
    dateStart: str = ""
    dateEnd: str = ""
    duration: str = ""
    location: str = ""
    context: ExperienceContext = Field(default_factory=ExperienceContext)
    mission: str = ""
    activities: list[ExperienceActivity] = Field(default_factory=list)
    results: list[ExperienceResult] = Field(default_factory=list)
    tech: list[ExperienceTech] = Field(default_factory=list)


class CvData(_Loose):
    """Miroir du schéma Zod `cvDataSchema` côté libs/shared/schemas."""

    identity: Identity = Field(default_factory=Identity)
    skills: list[Skill] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    languages: list[Language] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    experiences: list[Experience] = Field(default_factory=list)


class JobProfilePayload(_Loose):
    """Sous-ensemble de Prisma.JobProfile transmis pour l'adaptation."""

    title: str
    experienceLevel: str
    requiredSkills: list[str] = Field(default_factory=list)
    optionalSkills: list[str] = Field(default_factory=list)
    missions: str = ""
    education: str = ""
