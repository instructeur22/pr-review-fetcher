import { BotMetadata } from '../types';

const DEEPSOURCE_LOGINS = new Set([
  'deepsource-io',
  'deepsource-io[bot]',
  'deepsource',
  'deepsource[bot]',
  'deepsource-autofix',
  'deepsource-autofix[bot]'
]);

export function isDeepSourceComment(author: string, body: string, isBot = false): boolean {
  const authorLower = author.toLowerCase();
  if (DEEPSOURCE_LOGINS.has(authorLower)) {
    return true;
  }
  if (
    isBot &&
    (body.includes('<!-- DeepSource:') ||
      body.includes('deepsource.com') ||
      body.includes('static.deepsource.com'))
  ) {
    return true;
  }
  return false;
}

export interface ParsedDeepSourceData {
  metadata: BotMetadata;
  explanation: string;
}

export function parseDeepSourceComment(body: string): ParsedDeepSourceData {
  let severity: 'P1' | 'P2' | 'P3' | undefined;
  let rawCategory: string | undefined;
  let title: string | undefined;

  // 1. Détection de la sévérité via les badges SVG DeepSource ou mots-clés
  const sevMatch = body.match(/severity(?:_indicator)?_(critical|major|minor|info)\.svg/i);
  if (sevMatch) {
    const s = sevMatch[1].toLowerCase();
    if (s === 'critical') severity = 'P1';
    else if (s === 'major') severity = 'P2';
    else severity = 'P3';
  } else if (/\b(critical|blocking)\b/i.test(body)) {
    severity = 'P1';
  } else if (/\b(major|warning)\b/i.test(body)) {
    severity = 'P2';
  } else if (/\b(minor|info)\b/i.test(body)) {
    severity = 'P3';
  }

  // 2. Détection de la catégorie
  const catMatch = body.match(/category_([a-zA-Z0-9_-]+)\.svg/i);
  if (catMatch) {
    rawCategory = catMatch[1];
  }

  // 3. Détection du titre (dans <h3>)
  const h3Match = body.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (h3Match) {
    title = h3Match[1].replace(/<[^>]+>/g, '').trim();
  }

  // 4. Nettoyage de l'explication pour supprimer la pollution HTML brute
  const cleanedExplanation = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
    .replace(/<picture[\s\S]*?<\/picture>/gi, '')
    .replace(/<div[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  return {
    metadata: {
      botName: 'deepsource',
      severity,
      title,
      rawCategory
    },
    explanation: cleanedExplanation
  };
}
