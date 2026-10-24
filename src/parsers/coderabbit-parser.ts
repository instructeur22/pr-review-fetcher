import { BotMetadata } from '../types';

const CODERABBIT_LOGINS = new Set([
  'coderabbitai',
  'coderabbitai[bot]',
  'coderabbit',
  'coderabbit[bot]'
]);

export function isCodeRabbitComment(author: string, body: string, isBot = false): boolean {
  const authorLower = author.toLowerCase();
  if (CODERABBIT_LOGINS.has(authorLower)) {
    return true;
  }
  if (isBot && (body.includes('coderabbitai') || body.includes('<!-- Commitable suggestion -->'))) {
    return true;
  }
  return false;
}

export interface ParsedCodeRabbitData {
  metadata: BotMetadata;
  explanation: string;
}

export function parseCodeRabbitComment(body: string): ParsedCodeRabbitData {
  let title: string | undefined;
  let severity: string | undefined;

  // 1. Élimination des blocs de code pour éviter les faux positifs (ex: "let high = 10")
  const textWithoutCode = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '');

  // 2. Détection de la sévérité en italique markdown (ex: _🔴 Critical_, _🟠 Major_, _Critical_)
  const italicSeverityMatch = textWithoutCode.match(
    /(?:^|\||\s)_(?:[^\w\r\n]*\s*)?(Critical|Major|Medium|Warning|Minor|Nit|Low|Trivial|Info)\s*_(?:$|\||\s)/iu
  );

  if (italicSeverityMatch) {
    const level = italicSeverityMatch[1].toLowerCase();
    if (['critical', 'blocking'].includes(level)) severity = 'P1';
    else if (['major', 'medium', 'warning'].includes(level)) severity = 'P2';
    else severity = 'P3';
  } else {
    // Détection des marqueurs de sévérité explicites dans le texte
    const explicitSeverityMatch = textWithoutCode.match(
      /\b(?:severity|priority)\s*:\s*(critical|high|medium|warning|low|minor|nit)\b/i
    );
    if (explicitSeverityMatch) {
      const level = explicitSeverityMatch[1].toLowerCase();
      if (['critical', 'high'].includes(level)) severity = 'P1';
      else if (['medium', 'warning'].includes(level)) severity = 'P2';
      else severity = 'P3';
    } else if (
      /(?:^|\s)(?:critical|blocking)(?:$|\s)/i.test(textWithoutCode) ||
      /\b(critical|blocking)\b/i.test(textWithoutCode)
    ) {
      severity = 'P1';
    } else if (
      /(?:^|\s)(?:warning)(?:$|\s)/i.test(textWithoutCode) ||
      /\b(warning)\b/i.test(textWithoutCode)
    ) {
      severity = 'P2';
    } else if (
      /(?:^|\s)(?:minor|nit)(?:$|\s)/i.test(textWithoutCode) ||
      /\b(minor|nit)\b/i.test(textWithoutCode)
    ) {
      severity = 'P3';
    }
  }

  // 3. Détection des titres CodeRabbit :
  // Priorité A : Heading markdown ### Titre
  // Priorité B : Ligne en gras **Titre** isolée hors <details>
  const bodyWithoutDetails = body.replace(/<details[\s\S]*?<\/details>/gi, '');
  const headingMatch = bodyWithoutDetails.match(/(?:^|\n)###?\s+([^\r\n]+)/);
  const boldMatch = bodyWithoutDetails.match(/(?:^|\n)\s*\*\*([^\r\n]+?)\*\*\s*(?:\r?\n|$)/);

  let matchedTitleLine: string | undefined;
  if (headingMatch) {
    title = headingMatch[1].trim();
    matchedTitleLine = headingMatch[0];
  } else if (boldMatch) {
    title = boldMatch[1].trim();
    matchedTitleLine = boldMatch[0];
  }

  // 4. Nettoyage des commentaires HTML internes, scripts et prompts IA de CodeRabbit
  let cleanedExplanation = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<details[^>]*>(?:(?!<\/details>)[\s\S])*?<summary[^>]*>(?:(?!<\/summary>)[\s\S])*?Prompt for AI Agents(?:(?!<\/summary>)[\s\S])*?<\/summary>[\s\S]*?<\/details>/gi,
      ''
    )
    .replace(
      /<details[^>]*>(?:(?!<\/details>)[\s\S])*?<summary[^>]*>(?:(?!<\/summary>)[\s\S])*?Supported by static analysis(?:(?!<\/summary>)[\s\S])*?<\/summary>[\s\S]*?<\/details>/gi,
      ''
    );

  // Retirer la ligne d'en-tête de badges italiques (ex: _🔒 Security & Privacy_ | _🟠 Major_ | _⚡ Quick win_)
  cleanedExplanation = cleanedExplanation.replace(
    /(?:^|\n)\s*_[^_]+_\s*\|\s*_[^_]+_\s*(?:\|\s*_[^_]+_\s*)*(?:\r?\n|$)/g,
    '\n'
  );

  if (matchedTitleLine) {
    cleanedExplanation = cleanedExplanation.replace(matchedTitleLine, '');
  }

  cleanedExplanation = cleanedExplanation.trim();

  return {
    metadata: {
      botName: 'coderabbit',
      title,
      severity
    },
    explanation: cleanedExplanation
  };
}
