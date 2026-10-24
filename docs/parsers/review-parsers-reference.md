# Parseurs de revues — Référence

Règles de détection et structures de données des modules d'analyse de `pr-review-fetcher`.

---

## Vue d'ensemble

Le moteur traite chaque commentaire retourné par l'API GitHub (`/pulls/{id}/comments`), identifie la source (humain ou bot), extrait le niveau de sévérité et isole les modifications de code suggérées.

## Parseur Greptile (`greptile-apps`)

Le module `greptile-parser.ts` traite les commentaires postés par le bot Greptile.

### Détection
- Nom d'utilisateur de l'auteur égal à `greptile-apps` ou contenant `greptile`.
- Marqueur de sévérité (`P0`, `P1`, `P2`, `P3`) combiné à une section `<details><summary>Artifacts</summary>`.

### Données extraites

| Propriété | Type | Description |
|---|---|---|
| `severity` | `'P0' \| 'P1' \| 'P2' \| 'P3'` | Niveau d'alerte détecté. |
| `title` | `string` | Titre du problème signalé. |
| `explanation` | `string` | Texte explicatif sans le titre ni le bloc d'artefacts. |
| `artifacts` | `string[]` | Chemins d'artefacts ou fichiers de logs listés dans la section repliable. |

## Parseur CodeRabbit (`coderabbitai`)

Le module `coderabbit-parser.ts` traite les revues postées par CodeRabbit.

### Détection
- Nom de l'auteur égal à `coderabbitai` ou `coderabbitai[bot]`.
- Marqueurs HTML internes (`<!-- Commitable suggestion -->`).

### Données extraites

| Propriété | Type | Description |
|---|---|---|
| `severity` | `string` | Niveau déduit des mots-clés (`critical` -> `P1`, `warning` -> `P2`, `minor` -> `P3`). |
| `title` | `string` | Titre extrait du premier en-tête `###`. |
| `explanation` | `string` | Texte épuré des balises HTML internes de suivi. |

## Parseur de suggestions de code

Le module `suggestion-parser.ts` extrait les blocs de code prêts à être appliqués.

### Syntaxes reconnues
1. Blocs markdown de suggestion GitHub :
   ````markdown
   ```suggestion
   nouveau_code
   ```
   ````
2. Blocs markdown diff explicites :
   ````markdown
   ```diff
   - ancien_code
   + nouveau_code
   ```
   ````

### Structure extraite

| Propriété | Type | Description |
|---|---|---|
| `type` | `'suggestion' \| 'diff' \| 'replacement'` | Format du bloc de modification. |
| `content` | `string` | Code recommandé. |
| `startLine` | `number` | Ligne de début ciblée dans le fichier. |
| `endLine` | `number` | Ligne de fin ciblée dans le fichier. |

## Limitations

- Les suggestions écrites en texte brut sans bloc de code markdown restent dans le champ `explanation` et ne génèrent pas d'entrée `CodeModification`.
