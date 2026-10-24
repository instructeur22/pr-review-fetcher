# Schéma XML Agent — Référence

Structure des balises, attributs et sections de données générés par l'option `--agent`.

---

## Vue d'ensemble

Le document produit suit la spécification XML 1.0 en UTF-8. Le code source, les diffs et les explications sont isolés dans des blocs `<![CDATA[...]]>`.

## Arborescence et Balises

### 1. Élément racine `<pr_review_report>`

| Attribut | Type | Description |
|---|---|---|
| `pr_number` | number | Numéro de la Pull Request sur GitHub. |
| `repo` | string | Dépôt au format `propriétaire/dépôt`. |
| `url` | string | Lien web vers la Pull Request. |
| `fetched_at` | string | Date et heure de la requête (ISO-8601). |

### 2. Élément `<summary>`

Métadonnées de la PR :
- `<title>` : titre de la PR.
- `<author>` : auteur de la PR.
- `<state>` : état (`open`, `closed`, `merged`).
- `<head>` : branche source.
- `<base>` : branche cible.
- `<total_comments>` : nombre total de commentaires inclus.

### 3. Élément `<reviews>` et `<review_comment>`

Liste des commentaires analysés. Attributs de `<review_comment>` :

| Attribut | Type | Description |
|---|---|---|
| `id` | number | Identifiant GitHub du commentaire. |
| `file` | string | Fichier concerné. |
| `start_line` | number | Première ligne du bloc ciblé (si définie). |
| `end_line` | number | Dernière ligne du bloc ciblé. |
| `side` | string | Côté du diff (`LEFT` ou `RIGHT`). |

#### Sous-éléments de `<review_comment>`
- `<url>` : lien direct vers le commentaire.
- `<created_at>` : date de publication.
- `<author is_bot="true|false">` : auteur du commentaire.
- `<bot_metadata>` (présent pour les bots reconnus) :
  - `<bot_name>` : nom (`greptile`, `coderabbit`, `github_bot`).
  - `<severity>` : niveau d'alerte (`P0`, `P1`, `P2`, `P3`).
  - `<title>` : résumé court du problème.
  - `<artifacts>` : liste d'éléments `<artifact>`.
- `<diff_hunk>` : bloc de diff entouré de `<![CDATA[...]]>`.
- `<code_context>` : extrait de code ciblé avec numéros de lignes entouré de `<![CDATA[...]]>`.
- `<explanation>` : explication textuelle entourée de `<![CDATA[...]]>`.
- `<recommended_modifications>` : liste de balises `<modification type="suggestion|diff">` entourées de `<![CDATA[...]]>`.

## Exemple

```xml
<?xml version="1.0" encoding="UTF-8"?>
<pr_review_report pr_number="12" repo="owner/repo" url="https://github.com/owner/repo/pull/12" fetched_at="2026-09-05T18:00:00.000Z">
  <summary>
    <title>Fix parser bug</title>
    <author>dev</author>
    <state>open</state>
    <head>fix-branch</head>
    <base>main</base>
    <total_comments>1</total_comments>
  </summary>
  <reviews count="1">
    <review_comment id="4567" file="src/app.ts" start_line="10" end_line="12" side="RIGHT">
      <url>https://github.com/owner/repo/pull/12#discussion_r4567</url>
      <created_at>2026-09-05T17:40:00Z</created_at>
      <author is_bot="true">greptile-apps</author>
      <bot_metadata>
        <bot_name>greptile</bot_name>
        <severity>P1</severity>
        <title>Vulnérabilité d'injection</title>
      </bot_metadata>
      <diff_hunk><![CDATA[@@ -10,3 +10,3 @@\n+ const q = query;]]></diff_hunk>
      <explanation><![CDATA[Évitez l'interpolation directe.]]></explanation>
      <recommended_modifications count="1">
        <modification type="suggestion"><![CDATA[const q = sanitize(query);]]></modification>
      </recommended_modifications>
    </review_comment>
  </reviews>
</pr_review_report>
```

## Limitations

- La suite de caractères `]]>` dans les textes est remplacée par `]]]]><![CDATA[>` pour éviter de casser la balise CDATA.
