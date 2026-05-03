"""Rendu d'un CvData en PDF via Jinja2 + WeasyPrint.

Les templates HTML+CSS sont print-ready (`@page A4`, `@media print`)
— WeasyPrint les transforme en PDF fidèle à la mise en page Tekteo.

Templates attendus dans `TEMPLATES_ROOT` :
- cv-classic.html.jinja
- cv-modern.html.jinja

Si le template demandé n'existe pas, on bascule sur un rendu minimal
auto-généré (utile pour les premiers tests, à remplacer par les vrais
templates en prod).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape, TemplateNotFound
from weasyprint import HTML

from cv_schema import CvData

logger = logging.getLogger(__name__)

TEMPLATES_ROOT = Path(os.environ.get("TEMPLATES_ROOT", "/data/templates"))


def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_ROOT)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def render_cv_to_pdf(
    cv_data: CvData,
    template_id: str,
    output_path: str | Path,
) -> Path:
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    template_name = f"cv-{template_id}.html.jinja"
    try:
        template = _env().get_template(template_name)
        html_str = template.render(**cv_data.model_dump())
        logger.info("WeasyPrint: rendu via %s", template_name)
    except TemplateNotFound:
        logger.warning(
            "Template %s introuvable dans %s — fallback HTML basique. "
            "Pose un fichier `%s` pour utiliser ton design.",
            template_name,
            TEMPLATES_ROOT,
            template_name,
        )
        html_str = _fallback_html(cv_data)

    HTML(string=html_str, base_url=str(TEMPLATES_ROOT)).write_pdf(target=str(output))
    return output


# ----------------------------------------------------------------------
# Fallback HTML — design minimal pour démarrer sans template designé
# ----------------------------------------------------------------------


_FALLBACK_TEMPLATE = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>{{ identity.firstName }} {{ identity.lastName }} — CV</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1a1a2e; line-height: 1.45; }
  h1 { font-size: 26pt; margin: 0 0 4pt; }
  h2 { font-size: 11pt; color: #2E5BBA; margin: 16pt 0 6pt; border-bottom: 1pt solid #dfe3ec; padding-bottom: 2pt; text-transform: uppercase; letter-spacing: 0.06em; }
  h3 { font-size: 11pt; margin: 10pt 0 2pt; }
  .role { font-size: 12pt; color: #555568; margin-bottom: 6pt; }
  .contact { font-size: 9pt; color: #555568; margin-bottom: 12pt; }
  ul { margin: 4pt 0 8pt 16pt; padding: 0; }
  li { font-size: 10pt; margin-bottom: 2pt; }
  p { font-size: 10pt; margin: 4pt 0; }
  .meta { color: #8888a0; font-size: 9pt; font-style: italic; }
</style>
</head>
<body>
  <h1>{{ identity.firstName }} {{ identity.lastName }}</h1>
  {% if identity.role %}<div class="role">{{ identity.role }}</div>{% endif %}
  <div class="contact">
    {% if identity.email %}{{ identity.email }} · {% endif %}
    {% if identity.phone %}{{ identity.phone }} · {% endif %}
    {% if identity.location %}{{ identity.location }}{% endif %}
  </div>

  {% if skills %}
  <h2>Compétences</h2>
  <ul>{% for s in skills %}<li>{{ s.name }} ({{ s.level }}/100)</li>{% endfor %}</ul>
  {% endif %}

  {% if tools %}
  <h2>Outils</h2>
  <p>{{ tools | join(', ') }}</p>
  {% endif %}

  {% if languages %}
  <h2>Langues</h2>
  <ul>{% for l in languages %}<li>{{ l.name }} — {{ l.levelLabel or (l.dots ~ '/5') }}</li>{% endfor %}</ul>
  {% endif %}

  {% if experiences %}
  <h2>Expériences</h2>
  {% for exp in experiences %}
    <h3>{{ exp.role }} — {{ exp.company }}</h3>
    <div class="meta">{{ exp.dateStart }} → {{ exp.dateEnd }}{% if exp.location %} · {{ exp.location }}{% endif %}</div>
    {% if exp.mission %}<p>{{ exp.mission }}</p>{% endif %}
    {% if exp.activities %}
    <ul>
      {% for a in exp.activities %}<li>{% if a.bold %}<strong>{{ a.bold }} :</strong> {% endif %}{{ a.text }}</li>{% endfor %}
    </ul>
    {% endif %}
  {% endfor %}
  {% endif %}

  {% if education %}
  <h2>Formation</h2>
  <ul>{% for e in education %}<li>{{ e.degree }}{% if e.school %} — {{ e.school }}{% endif %}{% if e.year %} ({{ e.year }}){% endif %}</li>{% endfor %}</ul>
  {% endif %}

  {% if certifications %}
  <h2>Certifications</h2>
  <ul>{% for c in certifications %}<li>{{ c.name }}{% if c.year %} ({{ c.year }}){% endif %}</li>{% endfor %}</ul>
  {% endif %}
</body>
</html>"""


def _fallback_html(cv_data: CvData) -> str:
    env = Environment(autoescape=select_autoescape(["html", "xml"]))
    template = env.from_string(_FALLBACK_TEMPLATE)
    return template.render(**cv_data.model_dump())
