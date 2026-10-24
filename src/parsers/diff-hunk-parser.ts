export interface ExtractedCodeContext {
  focusedDiffHunk: string;
  codeContext: string;
}

export interface ParsedDiffLine {
  raw: string;
  type: '+' | '-' | ' ' | '\\' | '';
  oldCursor: number;
  newCursor: number;
  oldNum?: number;
  newNum?: number;
  content: string;
}

function normalizeDiffHunk(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\n+|\n+$/g, '');
}

/**
 * Extrait le contexte de code ciblé et le diff hunk focalisé correspondant
 * exactement aux lignes commentées et au bloc affiché sur l'interface GitHub.
 */
export function extractCodeContext(
  rawDiffHunk?: string,
  line?: number,
  startLine?: number,
  side?: string
): ExtractedCodeContext {
  if (!rawDiffHunk || rawDiffHunk.trim() === '') {
    return { focusedDiffHunk: '', codeContext: '' };
  }

  const normalized = normalizeDiffHunk(rawDiffHunk);
  const lines = normalized.split('\n');

  // Localiser la ligne d'en-tête @@
  let headerIndex = -1;
  let headerMatch: RegExpMatchArray | null = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@(.*)$/);
    if (m) {
      headerIndex = i;
      headerMatch = m;
      break;
    }
  }

  if (!headerMatch || headerIndex === -1) {
    return { focusedDiffHunk: rawDiffHunk, codeContext: rawDiffHunk };
  }

  const oldStart = parseInt(headerMatch[1], 10);
  const newStart = parseInt(headerMatch[2], 10);
  if (isNaN(oldStart) || isNaN(newStart)) {
    return { focusedDiffHunk: rawDiffHunk, codeContext: rawDiffHunk };
  }

  let oldCursor = oldStart;
  let newCursor = newStart;
  const parsed: ParsedDiffLine[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.startsWith('+')) {
      parsed.push({
        raw,
        type: '+',
        oldCursor,
        newCursor,
        newNum: newCursor,
        content: raw.slice(1)
      });
      newCursor++;
    } else if (raw.startsWith('-')) {
      parsed.push({
        raw,
        type: '-',
        oldCursor,
        newCursor,
        oldNum: oldCursor,
        content: raw.slice(1)
      });
      oldCursor++;
    } else if (raw.startsWith(' ')) {
      parsed.push({
        raw,
        type: ' ',
        oldCursor,
        newCursor,
        oldNum: oldCursor,
        newNum: newCursor,
        content: raw.slice(1)
      });
      oldCursor++;
      newCursor++;
    } else if (raw.startsWith('\\')) {
      parsed.push({
        raw,
        type: '\\',
        oldCursor,
        newCursor,
        content: raw
      });
    } else {
      parsed.push({
        raw,
        type: '',
        oldCursor,
        newCursor,
        content: raw
      });
    }
  }

  if (parsed.length === 0) {
    return { focusedDiffHunk: rawDiffHunk, codeContext: '' };
  }

  const isLeft = side === 'LEFT';

  const matchesTarget = (item: ParsedDiffLine, targetLine: number): boolean => {
    if (isLeft) {
      return item.oldNum === targetLine;
    }
    return item.newNum === targetLine;
  };

  const getDisplayLineNum = (item: ParsedDiffLine): number | undefined => {
    if (item.type === '+') return item.newNum;
    if (item.type === '-') return item.oldNum;
    if (item.type === ' ') return isLeft ? item.oldNum : item.newNum;
    return undefined;
  };

  // 1. Déterminer l'index de fin (ligne ciblée par le commentaire)
  let endIndex = parsed.length - 1;
  let lineFound = false;

  if (line !== undefined) {
    for (let i = parsed.length - 1; i >= 0; i--) {
      if (matchesTarget(parsed[i], line)) {
        endIndex = i;
        lineFound = true;
        break;
      }
    }
    // Repli tolérant si non trouvé sous la contrainte stricte de side
    if (!lineFound) {
      for (let i = parsed.length - 1; i >= 0; i--) {
        if (parsed[i].newNum === line || parsed[i].oldNum === line) {
          endIndex = i;
          lineFound = true;
          break;
        }
      }
    }
    // Si la ligne n'est toujours pas trouvée, GitHub termine généralement diff_hunk
    // à la ligne commentée : on utilise parsed.length - 1 par défaut.
  }

  // 2. Déterminer l'index de début (si commentaire multiligne)
  const effectiveStart = startLine !== undefined && startLine <= (line ?? startLine) ? startLine : line;
  let startIndex = endIndex;

  if (effectiveStart !== undefined && effectiveStart !== line) {
    let startFound = false;
    for (let i = 0; i <= endIndex; i++) {
      if (matchesTarget(parsed[i], effectiveStart)) {
        startIndex = i;
        startFound = true;
        break;
      }
    }
    if (!startFound) {
      for (let i = 0; i <= endIndex; i++) {
        if (parsed[i].newNum === effectiveStart || parsed[i].oldNum === effectiveStart) {
          startIndex = i;
          break;
        }
      }
    }
  }

  startIndex = Math.min(startIndex, endIndex);

  // 3. Fenêtre de contexte : jusqu'à 3 lignes de contexte au-dessus, avec au moins 4 lignes au total si disponible
  const contextBefore = 3;
  let sliceStart = Math.max(0, startIndex - contextBefore);
  if (endIndex - sliceStart + 1 < 4 && parsed.length >= 4) {
    sliceStart = Math.max(0, endIndex - 3);
  }

  const selected = parsed.slice(sliceStart, endIndex + 1);
  if (selected.length === 0) {
    return { focusedDiffHunk: rawDiffHunk, codeContext: '' };
  }

  // Inclure le marqueur '\ No newline at end of file' s'il suit immédiatement la dernière ligne sélectionnée
  if (endIndex + 1 < parsed.length && parsed[endIndex + 1].type === '\\') {
    selected.push(parsed[endIndex + 1]);
  }

  // 4. Calcul de l'en-tête de diff unifié pour le fragment découpé
  const first = selected[0];
  const oldLen = selected.filter(x => x.type === '-' || x.type === ' ').length;
  const newLen = selected.filter(x => x.type === '+' || x.type === ' ').length;
  const sliceOldStart = oldLen === 0 ? Math.max(0, first.oldCursor - 1) : first.oldCursor;
  const sliceNewStart = newLen === 0 ? Math.max(0, first.newCursor - 1) : first.newCursor;

  const newHeader = `@@ -${sliceOldStart},${oldLen} +${sliceNewStart},${newLen} @@`;
  const focusedDiffHunk = [newHeader, ...selected.map(x => x.raw)].join('\n');

  // 5. Formatage du bloc de contexte de code avec numéros de lignes
  const codeContext = selected
    .map(x => {
      if (x.type === '\\') {
        return x.raw;
      }
      const num = getDisplayLineNum(x);
      const numStr = num !== undefined ? String(num) : '';
      const prefix = x.type || ' ';
      const suffix = x.content.length > 0 ? ` ${x.content}` : '';
      return `${numStr} ${prefix}${suffix}`.trimStart();
    })
    .join('\n');

  return { focusedDiffHunk, codeContext };
}

function formatLinesContext(lines: ParsedDiffLine[], isLeft: boolean): string {
  return lines
    .map(x => {
      if (x.type === '\\') return x.raw;
      const num = x.type === '+' ? x.newNum : x.type === '-' ? x.oldNum : isLeft ? x.oldNum : x.newNum;
      const numStr = num !== undefined ? String(num) : '';
      const prefix = x.type || ' ';
      const suffix = x.content.length > 0 ? ` ${x.content}` : '';
      return `${numStr} ${prefix}${suffix}`.trimStart();
    })
    .join('\n');
}
