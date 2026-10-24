# Guide d'Automatisation GitHub Actions & Agent Gemini

Ce guide explique comment brancher `pr-review-fetcher` et la boucle de revue automatisée à n'importe quel dépôt GitHub.

---

## 1. Fonctionnalités de la Boucle de Revue

1. **Niveau 1 — Synthèse Automatique des Revues** :
   - À chaque soumission d'une revue par un bot (CodeRabbit, Greptile), un résumé clair est publié ou mis à jour sur la PR avec le décompte par sévérité (**P0**, **P1**, **P2**, **P3**).
   - Le rapport XML complet est archivé en artefact GitHub Actions pour consultation ou injection directe dans un LLM.

2. **Niveau 2 — Résolution Assistée par Gemini (`/fix-reviews`)** :
   - Lorsqu'un collaborateur ou propriétaire commente `/fix-reviews` sur la PR, le workflow :
     1. Extrait les retours actifs via `pr-review-fetcher --agent`.
     2. Invoque l'agent Gemini en respectant les invariants de sécurité de `GEMINI.md` (données de revue traitées comme non fiables).
     3. Applique les correctifs de manière chirurgicale sans toucher aux zones protégées (`.github/**`, etc.).
     4. Exécute les tests locaux du dépôt si présents.
     5. Pousse un commit conventionnel `fix(review): ...` sur la branche de la PR.
     6. Relance automatiquement CodeRabbit (`@coderabbitai review`).

---

## 2. Installation Rapide sur un Nouveau Dépôt

### Étape 1 : Ajouter le Workflow Appelant
Créez le fichier `.github/workflows/pr-review-loop.yml` dans votre dépôt cible :

```yaml
name: PR Review Loop

on:
  pull_request_review:
    types: [submitted]
  issue_comment:
    types: [created]
  workflow_dispatch:
    inputs:
      mode:
        description: 'Mode d exécution'
        required: true
        default: 'summary'
        type: choice
        options:
          - summary
          - fix

concurrency:
  group: review-loop-${{ github.event.pull_request.number || github.event.issue.number || github.ref }}
  cancel-in-progress: false

jobs:
  review-loop:
    uses: instructeur22/pr-review-fetcher/.github/workflows/review-loop.yml@main
    permissions:
      contents: write
      pull-requests: write
      issues: write
    secrets:
      GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

### Étape 2 : Configurer le Secret Gemini (Optionnel pour le Niveau 2)
Dans les paramètres du dépôt GitHub :
* **Settings** > **Secrets and variables** > **Actions**.
* Ajoutez un secret nommé `GEMINI_API_KEY` avec votre clé d'API Google AI Studio / Gemini.

---

## 3. Sécurité et Bonnes Pratiques

* **Autorisation stricte** : Seuls les rôles `OWNER`, `MEMBER` et `COLLABORATOR` peuvent déclencher la commande `/fix-reviews`. Les commentaires de tiers sont ignorés.
* **Fichiers protégés** : Aucun agent IA ne peut modifier les workflows `.github/`, les hooks Git, ni les politiques de gouvernance sans validation humaine.
* **Contrôle humain final** : L'agent ne fusionne **jamais** de Pull Request (`gh pr merge` reste sous la responsabilité exclusive du mainteneur).
