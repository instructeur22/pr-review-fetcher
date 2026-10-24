# CLI pr-review-fetcher — Référence

Options, syntaxes, authentification et codes de sortie de l'exécutable `pr-review-fetcher`.

---

## Syntaxe

```bash
pr-review-fetcher [CIBLE] [OPTIONS]
```

## Arguments

| Argument | Type | Requis | Description |
|---|---|---|---|
| `CIBLE` | string | Non | URL GitHub (`https://github.com/owner/repo/pull/123`), identifiant court (`owner/repo#123`) ou numéro seul (`123`). Par défaut, utilise la PR de la branche locale courante. |

## Options

| Option | Alias | Type | Défaut | Description |
|---|---|---|---|---|
| `--agent` | `-a` | boolean | `false` | Produit une sortie XML structurée avec sections CDATA pour agents IA. |
| `--json` | `-j` | boolean | `false` | Affiche les données au format JSON. |
| `--output <FICHIER>` | `-o` | string | stdout | Écrit la sortie dans le fichier indiqué. |
| `--token <TOKEN>` | `-t` | string | — | Token d'accès GitHub pour les dépôts privés ou pour étendre le quota. |
| `--help` | `-h` | boolean | `false` | Affiche l'aide et quitte avec le code 0. |
| `--version` | `-v` | boolean | `false` | Affiche la version et quitte avec le code 0. |

## Authentification

L'outil cherche un token dans cet ordre :
1. Valeur passée avec `--token <TOKEN>` ou `--token=<TOKEN>`.
2. Variable d'environnement `GITHUB_TOKEN`.
3. Variable d'environnement `GH_TOKEN`.
4. Session locale de GitHub CLI (`gh auth token`).
5. Aucun token (requêtes anonymes pour dépôts publics, limitées à 60 req/h).

## Codes de sortie

| Code | Signification |
|---|---|
| `0` | Succès, données extraites ou aide affichée. |
| `1` | Erreur : cible invalide, PR introuvable (404), quota d'API dépassé (403) ou token rejeté (401). |

## Exemples

```bash
# Affichage direct dans le terminal
pr-review-fetcher https://github.com/astral-sh/uv/pull/5000

# Fichier XML pour agent IA
pr-review-fetcher owner/repo#42 --agent -o review.xml

# Utilisation d'un token
pr-review-fetcher owner/repo#42 --token ghp_sec123456
```

## Limitations

- Les requêtes anonymes sont limitées par GitHub à 60 appels par heure par adresse IP.
- La récupération s'arrête à 1000 commentaires par PR (10 pages de 100).
