import { PRTarget, ReviewComment, PRReviewReport, BotMetadata } from './types';
import { RawPRDetails, RawReviewComment } from './github-client';
import { isGreptileComment, parseGreptileComment } from './parsers/greptile-parser';
import { isCodeRabbitComment, parseCodeRabbitComment } from './parsers/coderabbit-parser';
import { isDeepSourceComment, parseDeepSourceComment } from './parsers/deepsource-parser';
import { extractCodeModifications } from './parsers/suggestion-parser';
import { extractCodeContext } from './parsers/diff-hunk-parser';

export function processReviewComments(
  target: PRTarget,
  prDetails: RawPRDetails,
  rawReviewComments: RawReviewComment[]
): PRReviewReport {
  const commentMap = new Map<number, RawReviewComment>();
  for (const raw of rawReviewComments) {
    commentMap.set(raw.id, raw);
  }

  function getThreadRoot(c: RawReviewComment): RawReviewComment {
    let current = c;
    const visited = new Set<number>();
    while (current.in_reply_to_id && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = commentMap.get(current.in_reply_to_id);
      if (!parent) break;
      current = parent;
    }
    return current;
  }

  interface ProcessedInternal extends ReviewComment {
    effectiveLine: number;
    threadRootId: number;
  }

  const processedComments: ProcessedInternal[] = [];

  for (const raw of rawReviewComments) {
    const author = raw.user?.login || 'unknown';
    const isBot =
      raw.user?.type === 'Bot' ||
      author.endsWith('[bot]') ||
      author === 'greptile-apps' ||
      author === 'coderabbitai' ||
      author === 'deepsource-io';

    let botMetadata: BotMetadata | undefined;
    let explanation = raw.body;

    if (isGreptileComment(author, raw.body, isBot)) {
      const greptileData = parseGreptileComment(raw.body);
      botMetadata = greptileData.metadata;
      explanation = greptileData.explanation;
    } else if (isCodeRabbitComment(author, raw.body, isBot)) {
      const codeRabbitData = parseCodeRabbitComment(raw.body);
      botMetadata = codeRabbitData.metadata;
      explanation = codeRabbitData.explanation;
    } else if (isDeepSourceComment(author, raw.body, isBot)) {
      const deepSourceData = parseDeepSourceComment(raw.body);
      botMetadata = deepSourceData.metadata;
      explanation = deepSourceData.explanation;
    } else if (isBot) {
      botMetadata = {
        botName: 'github_bot'
      };
    }

    const root = getThreadRoot(raw);
    const line = raw.line ?? raw.original_line ?? root.line ?? root.original_line ?? undefined;
    const rawStart =
      raw.start_line ?? raw.original_start_line ?? root.start_line ?? root.original_start_line ?? undefined;
    const startLine = (rawStart !== undefined && rawStart !== line) ? rawStart : undefined;
    const side = raw.side ?? root.side;
    const rawDiffHunk = raw.diff_hunk || root.diff_hunk || '';

    const modifications = extractCodeModifications(raw.body, line, startLine);
    const { focusedDiffHunk, codeContext } = extractCodeContext(rawDiffHunk, line, startLine, side);

    processedComments.push({
      id: raw.id,
      path: raw.path,
      line,
      startLine,
      side,
      author,
      isBot,
      botMetadata,
      diffHunk: focusedDiffHunk,
      codeContext: codeContext.length > 0 ? codeContext : undefined,
      rawDiffHunk: rawDiffHunk.length > 0 ? rawDiffHunk : undefined,
      body: raw.body,
      explanation,
      modifications,
      url: raw.html_url,
      createdAt: raw.created_at,
      inReplyToId: raw.in_reply_to_id,
      effectiveLine: line ?? 0,
      threadRootId: root.id
    });
  }

  // Trier les commentaires : par fichier, puis par ligne effective, puis racine du thread, puis chronologie
  processedComments.sort((a, b) => {
    if (a.path !== b.path) {
      return a.path.localeCompare(b.path);
    }
    if (a.effectiveLine !== b.effectiveLine) {
      return a.effectiveLine - b.effectiveLine;
    }
    if (a.threadRootId !== b.threadRootId) {
      return a.threadRootId - b.threadRootId;
    }
    // Si c'est le commentaire racine lui-même, il passe avant ses réponses
    if (a.id === a.threadRootId) return -1;
    if (b.id === b.threadRootId) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const finalComments: ReviewComment[] = processedComments.map(
    ({ effectiveLine: _e, threadRootId: _t, ...rest }) => rest
  );

  return {
    target,
    title: prDetails.title,
    author: prDetails.user?.login || 'unknown',
    state: prDetails.state,
    body: prDetails.body || '',
    head: prDetails.head?.ref || '',
    base: prDetails.base?.ref || '',
    comments: finalComments,
    totalComments: finalComments.length,
    fetchedAt: new Date().toISOString()
  };
}
