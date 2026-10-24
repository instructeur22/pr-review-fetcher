# Format XML pour agents IA — Explication

Pourquoi `pr-review-fetcher` utilise le format XML avec sections CDATA pour transmettre les revues de code aux modèles de langage.

---

## Contexte

Lorsqu'un agent de code doit corriger un dépôt à partir de retours de review, il a besoin du fichier, des numéros de ligne et du diff exact.

En texte libre Markdown ou en JSON, deux problèmes surviennent souvent :
- Le modèle confond le code cité avec ses propres instructions système.
- Les blocs de code multilignes et les diffs perdent leur mise en forme à cause des échappements de caractères (notamment les retours à la ligne `\n` ou les guillemets).

## Comment ça fonctionne

Le drapeau `--agent` sépare les métadonnées de guidage et le code brut :

```
┌─────────────────────────────────────────────────────────────┐
│                    <pr_review_report>                       │
│  ┌───────────────────────┐   ┌───────────────────────────┐  │
│  │       <summary>       │   │         <reviews>         │  │
│  │ Dépôt, auteur, état   │   │  ┌─────────────────────┐  │  │
│  └───────────────────────┘   │  │  <review_comment>   │  │  │
│                              │  │  Fichier, lignes    │  │  │
│                              │  │  ┌───────────────┐  │  │  │
│                              │  │  │  <diff_hunk>  │  │  │  │
│                              │  │  │    [CDATA]    │  │  │  │
│                              │  │  └───────────────┘  │  │  │
│                              │  │  ┌───────────────┐  │  │  │
│                              │  │  │ <modifications│  │  │  │
│                              │  │  │    [CDATA]    │  │  │  │
│                              │  │  └───────────────┘  │  │  │
│                              │  └─────────────────────┘  │  │
│                              └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

Les données de ciblage (auteur, sévérité, lignes) sont placées dans des balises simples. Les textes longs, le diff et les suggestions de code sont enfermés dans des blocs `<![CDATA[...]]>`, sans transformation.

## Pourquoi ce choix

Trois raisons motivent cette organisation :

1. **Structuration claire entre données et instructions :** Le balisage XML aide l'agent à distinguer les métadonnées et le contenu des commentaires externes de ses instructions système. Bien que les délimiteurs XML ne constituent pas à eux seuls une frontière étanche contre les attaques par injection indirecte de prompt (qui requièrent une défense en profondeur au niveau du prompt système de l'agent), ils apportent un formatage sémantique explicite qui réduit les ambiguïtés d'interprétation.
2. **Diffs préservés à l'identique :** En JSON, chaque retour à la ligne ou caractère spécial doit être échappé (`\n`, `\"`, `\\`), ce qui rend les gros patches fragiles. Avec CDATA, le patch reste du texte brut direct.
3. **Repérage fiable par le modèle :** Les LLM actuels identifient nettement les balises fermantes (`</review_comment>`), ce qui permet de traiter les retours un par un sans déborder sur le suivant.

## Comparaison des formats

| Format | Avantages | Inconvénients pour les agents |
|---|---|---|
| **XML délimité (retenu)** | Séparation nette, blocs de code intacts via CDATA, pas d'échappement lourd. | Légèrement plus verbeux que du texte brut. |
| **JSON** | Format standard des API web. | Échappement obligatoire de tous les retours à la ligne et guillemets dans les diffs. |
| **Markdown brut** | Confortable pour un humain. | Risque de collision entre les blocs de code markdown imbriqués (```). |

## En pratique

Pour passer le rapport à un agent :

```bash
pr-review-fetcher https://github.com/owner/repo/pull/123 --agent
```

Le XML obtenu s'insère directement dans le contexte ou le prompt de l'agent sans retraitement.

## Pour continuer

- [Référence du schéma XML](xml-schema-reference.md) : détail des balises et attributs.
- [Guide pratique d'extraction](../cli/fetch-reviews-howto.md) : exemples de commandes.
