import { CodeModification } from '../types';

export function extractCodeModifications(
  body: string,
  line?: number,
  startLine?: number
): CodeModification[] {
  const modifications: CodeModification[] = [];

  // 1. Extraire les blocs de suggestions GitHub standard : ```suggestion ... ```
  const suggestionRegex = /```suggestion\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = suggestionRegex.exec(body)) !== null) {
    modifications.push({
      type: 'suggestion',
      content: match[1].trimEnd(),
      startLine: startLine ?? line,
      endLine: line
    });
  }

  // 2. Extraire les blocs diff explicites s'il n'y a pas de suggestion GitHub standard
  if (modifications.length === 0) {
    const diffBlockRegex = /```diff\r?\n([\s\S]*?)```/g;
    while ((match = diffBlockRegex.exec(body)) !== null) {
      modifications.push({
        type: 'diff',
        content: match[1].trimEnd(),
        startLine: startLine ?? line,
        endLine: line
      });
    }
  }

  return modifications;
}
