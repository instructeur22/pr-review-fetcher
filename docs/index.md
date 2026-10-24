# Documentation de pr-review-fetcher

Ce répertoire rassemble la documentation de `pr-review-fetcher`, un outil en ligne de commande pour extraire les commentaires et suggestions de code des Pull Requests GitHub.

## Organisation

La documentation suit le découpage Diátaxis en quatre rôles (guides pratiques, références techniques, explications conceptuelles et tutoriels) répartis selon les modules du projet.

## Modules

### 1. Interface en ligne de commande (CLI)
- [Index CLI](cli/index.md) : vue d'ensemble du module CLI.
- [Référence CLI](cli/cli-reference.md) : syntaxe, options, codes de sortie et variables d'environnement.
- [Guide pratique d'extraction](cli/fetch-reviews-howto.md) : extraire les commentaires d'une PR publique, privée ou locale.

### 2. Parseurs de revues
- [Index des parseurs](parsers/index.md) : vue d'ensemble du traitement des commentaires.
- [Référence des parseurs](parsers/review-parsers-reference.md) : règles de détection et champs extraits pour Greptile (P0 à P3), CodeRabbit et suggestions GitHub.

### 3. Sortie XML pour agents IA
- [Index Agent IA](agent/index.md) : vue d'ensemble du format agent.
- [Référence du schéma XML](agent/xml-schema-reference.md) : structure des balises, attributs et blocs CDATA générés par `--agent`.
- [Explication du format XML](agent/xml-agentic-pipeline-explanation.md) : raisons du choix du XML et des sections CDATA pour les modèles de langage.
