#!/usr/bin/env bun
import { resolvePRTarget } from './pr-resolver';
import { GitHubClient } from './github-client';
import { processReviewComments } from './comment-processor';
import { formatAgentXML } from './formatters/xml-agent-formatter';
import { formatTerminal } from './formatters/terminal-formatter';
import { formatJSON } from './formatters/json-formatter';
import { CLIOptions } from './types';

function printHelp(): void {
  console.log(`
pr-review-fetcher - Outil CLI autonome d'extraction des revues de Pull Request GitHub

UTILISATION:
  pr-review-fetcher [CIBLE] [OPTIONS]

CIBLE:
  URL GitHub de la PR : https://github.com/proprietaire/depot/pull/123
  Identifiant court   : proprietaire/depot#123 ou proprietaire/depot/123
  Numéro seul         : 123 (utilise le dépôt git local actuel)
  (Optionnel)         : Détection automatique de la PR courante si exécuté dans un dépôt git

OPTIONS:
  -a, --agent              Restitue les revues au format XML structuré (optimisé pour agents IA)
  -j, --json               Restitue les revues au format JSON structuré
  -o, --output <FICHIER>   Enregistre la sortie directement dans le fichier spécifié
  -t, --token <TOKEN>      Token d'accès personnel GitHub (PAT) pour dépôts privés ou quota étendu
  -h, --help               Affiche cette aide
  -v, --version            Affiche la version de l'outil

AUTHENTIFICATION:
  - Pour les dépôts publics, aucun token n'est obligatoire (détection automatique).
  - Pour les dépôts privés ou étendre le quota, vous pouvez passer --token <TOKEN>,
    définir GITHUB_TOKEN dans votre environnement, ou vous connecter avec 'gh auth login'.

EXEMPLES:
  # Affichage terminal sur un dépôt public :
  pr-review-fetcher https://github.com/facebook/react/pull/31234

  # Restitution au format XML pour un agent IA :
  pr-review-fetcher https://github.com/owner/repo/pull/42 --agent

  # Sauvegarde des revues XML dans un fichier :
  pr-review-fetcher owner/repo#42 --agent -o pr-review.xml

  # Utilisation avec un token spécifique :
  pr-review-fetcher owner/repo#42 -t ghp_votre_token
`);
}

function parseCLIArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    format: 'terminal'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }

    if (arg === '-v' || arg === '--version') {
      console.log('pr-review-fetcher v1.0.0');
      process.exit(0);
    }

    if (arg === '-a' || arg === '--agent') {
      options.format = 'agent';
      continue;
    }

    if (arg === '-j' || arg === '--json') {
      options.format = 'json';
      continue;
    }

    if (arg === '-t' || arg === '--token') {
      const next = args[++i];
      if (!next || next.startsWith('-')) {
        throw new Error("L'option '--token' requiert une valeur de token valide.");
      }
      options.token = next;
      continue;
    }
    if (arg.startsWith('--token=')) {
      options.token = arg.substring('--token='.length);
      continue;
    }

    if (arg === '-o' || arg === '--output') {
      const next = args[++i];
      if (!next || next.startsWith('-')) {
        throw new Error("L'option '--output' requiert un chemin de fichier valide.");
      }
      options.outputFile = next;
      continue;
    }
    if (arg.startsWith('--output=')) {
      options.outputFile = arg.substring('--output='.length);
      continue;
    }

    if (!arg.startsWith('-') && !options.target) {
      options.target = arg;
    }
  }

  return options;
}

export async function main(): Promise<void> {
  try {
    const options = parseCLIArgs(process.argv.slice(2));
    const target = resolvePRTarget(options.target);

    // Initialisation du client GitHub
    const client = new GitHubClient(options.token);

    // Récupération des informations de la PR et des commentaires de revue
    const [prDetails, reviewComments] = await Promise.all([
      client.getPullRequest(target),
      client.getReviewComments(target)
    ]);

    // Traitement et structuration des commentaires (Greptile, CodeRabbit, etc.)
    const report = processReviewComments(target, prDetails, reviewComments);

    // Formatage de la sortie
    let outputText = '';
    if (options.format === 'agent') {
      outputText = formatAgentXML(report);
    } else if (options.format === 'json') {
      outputText = formatJSON(report);
    } else {
      outputText = formatTerminal(report);
    }

    // Écriture de la sortie
    if (options.outputFile) {
      await Bun.write(options.outputFile, outputText);
      if (options.format === 'terminal') {
        console.log(`\n✔ Résultat enregistré avec succès dans : ${options.outputFile}`);
      }
    } else {
      console.log(outputText);
    }
  } catch (error: any) {
    console.error(`\x1b[31mErreur :\x1b[0m ${error.message || error}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
