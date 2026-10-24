import { PRReviewReport } from '../types';

export function sanitizeXmlChars(str: string): string {
  // Conserve uniquement \t (\x09), \n (\x0A), \r (\x0D) et les plages valides en XML 1.0 incluant les émojis
  return str.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '');
}

function escapeXml(str: string): string {
  return sanitizeXmlChars(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(content: string): string {
  const sanitized = sanitizeXmlChars(content);
  const safe = sanitized.replace(/]]>/g, ']]]]><![CDATA[>');
  return `<![CDATA[${safe}]]>`;
}

export function formatAgentXML(report: PRReviewReport): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<pr_review_report pr_number="${report.target.pullNumber}" repo="${escapeXml(
      `${report.target.owner}/${report.target.repo}`
    )}" url="${escapeXml(report.target.url)}" fetched_at="${escapeXml(report.fetchedAt)}">`
  );

  // Sommaire de la PR
  lines.push('  <summary>');
  lines.push(`    <title>${escapeXml(report.title)}</title>`);
  lines.push(`    <author>${escapeXml(report.author)}</author>`);
  lines.push(`    <state>${escapeXml(report.state)}</state>`);
  lines.push(`    <head>${escapeXml(report.head)}</head>`);
  lines.push(`    <base>${escapeXml(report.base)}</base>`);
  lines.push(`    <total_comments>${report.totalComments}</total_comments>`);
  lines.push('  </summary>');

  // Liste des commentaires de revue
  lines.push(`  <reviews count="${report.comments.length}">`);

  for (const comment of report.comments) {
    const startAttr = (comment.startLine !== undefined && comment.startLine !== comment.line) ? ` start_line="${comment.startLine}"` : '';
    const endAttr = comment.line !== undefined ? ` end_line="${comment.line}"` : '';
    const sideAttr = comment.side ? ` side="${escapeXml(comment.side)}"` : '';

    lines.push(
      `    <review_comment id="${comment.id}" file="${escapeXml(comment.path)}"${startAttr}${endAttr}${sideAttr}>`
    );
    lines.push(`      <url>${escapeXml(comment.url)}</url>`);
    lines.push(`      <created_at>${escapeXml(comment.createdAt)}</created_at>`);
    lines.push(
      `      <author is_bot="${comment.isBot}">${escapeXml(comment.author)}</author>`
    );

    if (comment.botMetadata) {
      lines.push('      <bot_metadata>');
      lines.push(`        <bot_name>${escapeXml(comment.botMetadata.botName)}</bot_name>`);
      if (comment.botMetadata.severity) {
        lines.push(`        <severity>${escapeXml(comment.botMetadata.severity)}</severity>`);
      }
      if (comment.botMetadata.title) {
        lines.push(`        <title>${escapeXml(comment.botMetadata.title)}</title>`);
      }
      if (comment.botMetadata.rawCategory) {
        lines.push(`        <category>${escapeXml(comment.botMetadata.rawCategory)}</category>`);
      }
      if (comment.botMetadata.artifacts && comment.botMetadata.artifacts.length > 0) {
        lines.push('        <artifacts>');
        for (const art of comment.botMetadata.artifacts) {
          lines.push(`          <artifact>${escapeXml(art)}</artifact>`);
        }
        lines.push('        </artifacts>');
      }
      lines.push('      </bot_metadata>');
    }

    if (comment.diffHunk) {
      lines.push(`      <diff_hunk>${cdata(comment.diffHunk)}</diff_hunk>`);
    }

    if (comment.codeContext) {
      lines.push(`      <code_context>${cdata(comment.codeContext)}</code_context>`);
    }

    lines.push(`      <explanation>${cdata(comment.explanation)}</explanation>`);

    if (comment.modifications.length > 0) {
      lines.push(`      <recommended_modifications count="${comment.modifications.length}">`);
      for (const mod of comment.modifications) {
        const modStart = mod.startLine ? ` start_line="${mod.startLine}"` : '';
        const modEnd = mod.endLine ? ` end_line="${mod.endLine}"` : '';
        lines.push(
          `        <modification type="${escapeXml(mod.type)}"${modStart}${modEnd}>${cdata(
            mod.content
          )}</modification>`
        );
      }
      lines.push('      </recommended_modifications>');
    }

    lines.push('    </review_comment>');
  }

  lines.push('  </reviews>');
  lines.push('</pr_review_report>');

  return lines.join('\n');
}
