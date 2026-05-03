# Templates HTML pour la génération de CV (PDF)

Ce dossier accueille les templates `cv-<id>.html.jinja` consommés par
le worker `apps/cv-worker` pour rendre les CV en `.pdf` via Jinja2 + WeasyPrint.

## Templates disponibles

- `cv-classic.html.jinja` : design Tekteo multi-pages (sommaire + 1 page par expérience), basé sur le template `cv-classic.html` historique
- `cv-modern.html.jinja` : *à créer* (le worker bascule sur un rendu de secours en attendant)

Les fichiers `.html` sans extension `.jinja` (ex. `cv-classic.html`,
`cv_template_tekteo.html`) sont les **maquettes de référence** avec
contenu d'exemple — utiles comme aperçu visuel, pas consommés par
le pipeline.

## Variables disponibles (modèle `CvData`)

```jinja
{{ identity.firstName }} {{ identity.lastName }}
{{ identity.role }}
{{ identity.email }} · {{ identity.phone }}
{{ identity.location }}
{{ identity.linkedin }}

{% for skill in skills %}
  {{ skill.name }} — {{ skill.level }}/100
{% endfor %}

{% for tool in tools %}{{ tool }}{% endfor %}

{% for lang in languages %}
  {{ lang.name }} · {{ lang.levelLabel }} · {{ lang.dots }}/5
{% endfor %}

{% for exp in experiences %}
  {{ exp.role }} — {{ exp.company }} ({{ exp.clientMeta }})
  {{ exp.dateStart }} → {{ exp.dateEnd }} · {{ exp.duration }} · {{ exp.location }}
  Contexte : {{ exp.context.team }} / {{ exp.context.methodology }} / {{ exp.context.role }}
  Mission : {{ exp.mission }}
  Activités :
    {% for a in exp.activities %}- {{ a.bold }} : {{ a.text }}{% endfor %}
  Résultats :
    {% for r in exp.results %}{{ r.value }} — {{ r.label }}{% endfor %}
  Stack :
    {% for t in exp.tech %}{{ t.category }} : {{ t['items'] }}{% endfor %}
{% endfor %}

{% for edu in education %}
  {{ edu.degree }} — {{ edu.school }} ({{ edu.year }})
{% endfor %}

{% for cert in certifications %}
  {{ cert.name }} ({{ cert.year }})
{% endfor %}
```

> **Important** : utilise `t['items']` (notation crochet) au lieu de
> `t.items` pour accéder au champ `items` d'un objet `tech` —
> sinon Jinja2 résout `.items` en méthode dict.items().

## Fallback automatique

Si un template `cv-<templateId>.html.jinja` est absent, le worker
bascule sur un rendu HTML minimal (cf. `pdf_renderer.py`). À remplacer
par un vrai template designé pour passer en prod.

## Tester un template localement

```bash
# Render avec un échantillon de CvData
python3 -c "
from jinja2 import Environment, FileSystemLoader
env = Environment(loader=FileSystemLoader('.'), trim_blocks=True, lstrip_blocks=True)
print(env.get_template('cv-classic.html.jinja').render(
    identity={'firstName': 'Alice', 'lastName': 'DURAND', ...},
    skills=[...], experiences=[...], ...
))" > /tmp/preview.html

# Visualiser dans le browser
xdg-open /tmp/preview.html
```

## Ajouter un nouveau template

1. Copie un template existant : `cp cv-classic.html.jinja cv-modern.html.jinja`
2. Modifie le CSS / la structure
3. Préserve les variables Jinja (`{{ }}` et `{% %}`) — ne les remplace pas par du contenu en dur
4. Référence le `templateId` correspondant dans `cvImportTemplateSchema` (`libs/shared/schemas`)
5. Redémarre le worker : `docker compose restart cv-worker`
