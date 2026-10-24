import { BotMetadata } from '../types';

const GREPTILE_LOGINS = new Set([
  'greptile',
  'greptile[bot]',
  'greptile-apps',
  'greptile-apps[bot]',
  'my-greptile-integration'
]);

export function isGreptileComment(author: string, body: string, isBot = false): boolean {
  const authorLower = author.toLowerCase();
  if (GREPTILE_LOGINS.has(authorLower)) {
    return true;
  }
  // Détection par marqueur de corps uniquement si le compte est reconnu comme bot
  if (
    isBot &&
    (/\b(P[0-3])\b/i.test(body) || /<img[^>]+alt=["']P[0-3]["']/i.test(body)) &&
    (body.includes('Artifacts') || body.includes('greptile') || body.includes('trex'))
  ) {
    return true;
  }
  return false;
}

export interface ParsedGreptileData {
  metadata: BotMetadata;
  explanation: string;
}

export function parseGreptileComment(body: string): ParsedGreptileData {
  let severity: 'P0' | 'P1' | 'P2' | 'P3' | undefined;
  let title: string | undefined;
  let artifacts: string[] = [];

  // 1. Détection de la sévérité et du titre
  // Cas A : Badge image HTML (ex: <a href="#"><img alt="P1" src="..."></a> **Titre**)
  const imgBadgeMatch = body.match(
    /(?:^|\n)\s*(?:<a[^>]*>\s*)?<img[^>]+alt=["'](P[0-3])["'][^>]*>(?:\s*<\/a>)?\s*(?:\*\*([^\r\n]+?)\*\*|[:\-–]?\s*([^\r\n]+))/i
  );

  // Cas B : Format texte / markdown standard (ex: "P1 Titre", "**P1**: Titre", "[P2] - Titre", "<span...>P3</span> Titre")
  const textSeverityMatch = body.match(
    /(?:^|\n)\s*(?:\[|\*\*|<span[^>]*>)?\s*(P[0-3])\s*(?:\]|\*\*|<\/span>)?\s*[:\-–]?\s*(?:\*\*([^\r\n]+?)\*\*|([^\r\n]+))/i
  );

  let matchedHeading: string | undefined;

  if (imgBadgeMatch) {
    severity = imgBadgeMatch[1].toUpperCase() as 'P0' | 'P1' | 'P2' | 'P3';
    const rawTitle = (imgBadgeMatch[2] || imgBadgeMatch[3] || '').trim();
    if (rawTitle.length > 0) {
      title = rawTitle;
    }
    matchedHeading = imgBadgeMatch[0];
  } else if (textSeverityMatch) {
    severity = textSeverityMatch[1].toUpperCase() as 'P0' | 'P1' | 'P2' | 'P3';
    const rawTitle = (textSeverityMatch[2] || textSeverityMatch[3] || '').trim();
    if (rawTitle.length > 0) {
      title = rawTitle;
    }
    matchedHeading = textSeverityMatch[0];
  }

  // 2. Extraction isolée des artefacts (gère <summary>Artifacts</summary>, <summary><strong>Artifacts</strong></summary>, etc.)
  const artifactsMatch = body.match(
    /<details[^>]*>(?:(?!<\/details>)[\s\S])*?<summary[^>]*>(?:(?!<\/summary>)[\s\S])*?Artifacts(?:(?!<\/summary>)[\s\S])*?<\/summary>([\s\S]*?)<\/details>/i
  );

  if (artifactsMatch) {
    const rawArtifacts = artifactsMatch[1].trim();
    // Nettoyer les balises de présentation / liens boutons HTML résiduels (ex: bouton "View artifacts")
    const cleanedRaw = rawArtifacts
      .replace(/<a[^>]*>\s*<picture>[\s\S]*?<\/picture>\s*<\/a>/gi, '')
      .replace(/<picture>[\s\S]*?<\/picture>/gi, '')
      .replace(/<img[^>]*>/gi, '')
      .replace(/<br\s*\/?>/gi, '');

    // Format T-Rex : **[Titre](URL)** suivi d'une description optionnelle
    const trexPattern = /\*\*\[([^\]]+)\]\(([^)]+)\)\*\*(?:\s*[-*]\s*([^\n\r]+))?/g;
    let match: RegExpExecArray | null;
    while ((match = trexPattern.exec(cleanedRaw)) !== null) {
      const artTitle = match[1].trim();
      const artUrl = match[2].trim();
      const artDesc = match[3] ? match[3].trim() : '';
      if (artDesc) {
        artifacts.push(`[${artTitle}](${artUrl}) - ${artDesc}`);
      } else {
        artifacts.push(`[${artTitle}](${artUrl})`);
      }
    }

    // Si aucun artefact T-Rex formaté n'a été trouvé, repli sur le format puces / lignes
    if (artifacts.length === 0) {
      artifacts = cleanedRaw
        .split('\n')
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(line => line.length > 0 && !line.startsWith('<'));
    }
  }

  // 3. Extraction de l'explication (enlever le titre de sévérité, la section artefacts et le boilerplate Greptile)
  let cleanBody = body;
  if (matchedHeading) {
    cleanBody = cleanBody.replace(matchedHeading, '');
  }
  if (artifactsMatch) {
    cleanBody = cleanBody.replace(artifactsMatch[0], '');
  }

  cleanBody = cleanBody
    .replace(
      /<details[^>]*>\s*<summary[^>]*>[\s\S]*?(?:Prompt To Fix With AI|Prompt pour corriger avec une IA)[\s\S]*?<\/summary>[\s\S]*?<\/details>/gi,
      ''
    )
    .replace(/<sub>[\s\S]*?<\/sub>/gi, '')
    .replace(/<a[^>]*href=["']https:\/\/app\.greptile\.com\/[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');

  const explanation = cleanBody.trim();

  return {
    metadata: {
      botName: 'greptile',
      severity,
      title,
      artifacts: artifacts.length > 0 ? artifacts : undefined
    },
    explanation
  };
}
