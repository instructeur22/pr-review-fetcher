# pr-review-fetcher

Outil CLI autonome pour extraire les commentaires de revue, discussions et modifications de code recommandées sur une Pull Request GitHub.

L'outil repère et structure les retours des bots d'analyse de code (Greptile avec ses niveaux P0 à P3, CodeRabbit et suggestions GitHub).

## Fonctionnalités

- Binaire autonome sans dépendance externe : un seul fichier exécutable, aucun runtime à installer.
- Extraction des revues : commentaires ciblés sur le code, blocs de diff (`diff_hunk`), numéros de ligne et suggestions.
- Parsing Greptile : détection des niveaux de priorité (P1, P2, P3), du titre du problème, des explications et des artefacts.
- Parsing CodeRabbit et suggestions GitHub : extraction directe des blocs de remplacement de code.
- Sortie XML pour agents IA (`--agent`) : données structurées avec sections CDATA, prêtes à être injectées dans un prompt de modèle de langage.
- Dépôts publics sans configuration : fonctionne directement avec l'URL de la PR.
- Prise en charge des tokens : accepte `--token`, `GITHUB_TOKEN`, `GH_TOKEN` ou le token de `gh auth token`.

---

## Utilisation

### Syntaxe
```bash
./pr-review-fetcher [CIBLE] [OPTIONS]
```

### Cible
- URL GitHub : `https://github.com/owner/repo/pull/123`
- Format court : `owner/repo#123`
- Numéro seul : `123` (depuis un clone local du dépôt)
- Sans argument : détecte la PR liée à la branche git courante

---

## Options

| Option | Alias | Description |
|---|---|---|
| `--agent` | `-a` | Sortie XML structurée pour agent IA |
| `--json` | `-j` | Sortie JSON |
| `--output <FICHIER>` | `-o` | Écrit la sortie dans un fichier |
| `--token <TOKEN>` | `-t` | Token GitHub pour dépôts privés ou pour dépasser la limite de requêtes |
| `--help` | `-h` | Affiche l'aide |
| `--version` | `-v` | Affiche la version |

---

## Exemples

### Affichage dans le terminal
```bash
./pr-review-fetcher https://github.com/facebook/react/pull/31234
```

### Export XML pour un agent
```bash
./pr-review-fetcher https://github.com/owner/repo/pull/42 --agent
```

Exemple de structure XML :
```xml
<?xml version="1.0" encoding="UTF-8"?>
<pr_review_report pr_number="42" repo="owner/repo" url="...">
  <summary>
    <title>Correction de sécurité</title>
    <author>contributeur</author>
    <total_comments>1</total_comments>
  </summary>
  <reviews count="1">
    <review_comment id="123456" file=".github/scripts/triage_issue.cjs" start_line="528" end_line="530">
      <author is_bot="true">greptile-apps</author>
      <bot_metadata>
        <bot_name>greptile</bot_name>
        <severity>P1</severity>
        <title>Marqueur de commentaire non authentifié</title>
      </bot_metadata>
      <diff_hunk><![CDATA[...]]></diff_hunk>
      <explanation><![CDATA[upsertTriageComment sélectionne le premier commentaire...]]></explanation>
      <recommended_modifications count="1">
        <modification type="suggestion"><![CDATA[...]]></modification>
      </recommended_modifications>
    </review_comment>
  </reviews>
</pr_review_report>
```

### Sauvegarde dans un fichier
```bash
./pr-review-fetcher owner/repo#42 --agent -o pr-reviews.xml
```

### Dépôt privé avec token
```bash
./pr-review-fetcher https://github.com/mon-orga/mon-projet/pull/15 -t ghp_mon_token
```

---

## Développement

```bash
# Tests unitaires
bun test

# Vérification TypeScript
bun x tsc --noEmit

# Compilation du binaire
bun run build
```
