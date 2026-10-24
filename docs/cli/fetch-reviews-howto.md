# Comment extraire les revues et suggestions d'une Pull Request

Ce guide montre comment extraire les commentaires de revue, les discussions et les suggestions de code d'une Pull Request GitHub avec `pr-review-fetcher`.

## Prérequis

- L'exécutable `pr-review-fetcher`.
- L'URL ou le numéro de la Pull Request.
- Un token GitHub si le dépôt est privé ou si le quota anonyme est épuisé.

## Étapes

### 1. Identifier la PR cible

Notez l'URL ou l'identifiant court de la PR :
- URL : `https://github.com/facebook/react/pull/31234`
- Identifiant : `facebook/react#31234`

### 2. Lancer l'extraction dans le terminal

Passez la cible en argument :

```bash
pr-review-fetcher https://github.com/facebook/react/pull/31234
```

Le terminal affiche les commentaires classés par fichier avec les diffs colorés et les niveaux de sévérité (P1, P2, P3 pour Greptile, CodeRabbit).

### 3. Exporter les données pour un agent

Ajoutez le drapeau `--agent` pour obtenir du XML ou `--json` pour du JSON, et redirigez vers un fichier avec `-o` :

```bash
pr-review-fetcher facebook/react#31234 --agent -o review-report.xml
```

## Cas particuliers

### Dépôt local actif

Depuis un clone git local lié à une PR ouverte, lancez l'outil sans argument :

```bash
pr-review-fetcher
```

Le programme lit la branche courante et interroge la PR correspondante via l'API.

### Dépôt privé ou quota atteint

Passez un token d'accès avec `-t` :

```bash
pr-review-fetcher mon-orga/mon-depot#12 -t ghp_mon_token
```

## Vérification

Vérifiez le contenu du fichier exporté :

```bash
head -n 5 review-report.xml
```

La sortie doit commencer par la déclaration XML et la balise `<pr_review_report>`.

## Commandes utiles

| Commande | Description |
|---|---|
| `pr-review-fetcher <CIBLE>` | Affiche les commentaires dans la console. |
| `pr-review-fetcher <CIBLE> --agent` | Génère un flux XML pour agent IA. |
| `pr-review-fetcher <CIBLE> -o fichier.xml` | Écrit le résultat dans un fichier. |
