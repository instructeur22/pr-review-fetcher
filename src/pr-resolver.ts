import { PRTarget } from './types';

export function parsePRUrlOrRef(input: string): PRTarget | null {
  const trimmed = input.trim();

  // 1. URL GitHub complète : https://github.com/owner/repo/pull/123
  const urlMatch = trimmed.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)/i);
  if (urlMatch) {
    const owner = urlMatch[1];
    const repo = urlMatch[2].replace(/\.git$/, '');
    const pullNumber = parseInt(urlMatch[3], 10);
    return {
      owner,
      repo,
      pullNumber,
      url: `https://github.com/${owner}/${repo}/pull/${pullNumber}`
    };
  }

  // 2. Format abrégé : owner/repo#123 ou owner/repo/123
  const refMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)[#/](\d+)$/);
  if (refMatch) {
    const owner = refMatch[1];
    const repo = refMatch[2].replace(/\.git$/, '');
    const pullNumber = parseInt(refMatch[3], 10);
    return {
      owner,
      repo,
      pullNumber,
      url: `https://github.com/${owner}/${repo}/pull/${pullNumber}`
    };
  }

  return null;
}

export function detectLocalGitPR(pullNumberOverride?: number): PRTarget {
  let owner = '';
  let repo = '';

  // 1. Détecter le remote git origin ou upstream
  const remotesToCheck = ['remote.origin.url', 'remote.upstream.url'];
  for (const remoteKey of remotesToCheck) {
    try {
      const proc = Bun.spawnSync(['git', 'config', '--get', remoteKey], {
        stdout: 'pipe',
        stderr: 'ignore',
        stdin: 'ignore',
        timeout: 5000
      });
      if (proc.exitCode === 0) {
        const remoteUrl = proc.stdout.toString().trim();
        const sshMatch = remoteUrl.match(/github\.com[:/]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/);
        if (sshMatch) {
          owner = sshMatch[1];
          repo = sshMatch[2].replace(/\.git$/, '');
          break;
        }
      }
    } catch {
      // Ignorer si git n'est pas disponible
    }
  }

  if (pullNumberOverride) {
    if (owner && repo) {
      return {
        owner,
        repo,
        pullNumber: pullNumberOverride,
        url: `https://github.com/${owner}/${repo}/pull/${pullNumberOverride}`
      };
    }
    // Tenter de résoudre ce numéro spécifique via gh
    try {
      const proc = Bun.spawnSync(['gh', 'pr', 'view', String(pullNumberOverride), '--json', 'number,url'], {
        stdout: 'pipe',
        stderr: 'ignore',
        stdin: 'ignore',
        timeout: 5000
      });
      if (proc.exitCode === 0) {
        const data = JSON.parse(proc.stdout.toString().trim());
        if (data.number && data.url) {
          const parsed = parsePRUrlOrRef(data.url);
          if (parsed) return parsed;
        }
      }
    } catch {
      // Ignorer
    }

    throw new Error(
      `Impossible de déterminer le dépôt GitHub pour la Pull Request #${pullNumberOverride}. Veuillez spécifier la cible complète (ex: owner/repo#${pullNumberOverride}).`
    );
  }

  // 2. Résoudre la PR de la branche courante via gh pr view
  try {
    const proc = Bun.spawnSync(['gh', 'pr', 'view', '--json', 'number,url'], {
      stdout: 'pipe',
      stderr: 'ignore',
      stdin: 'ignore',
      timeout: 5000
    });
    if (proc.exitCode === 0) {
      const data = JSON.parse(proc.stdout.toString().trim());
      if (data.number && data.url) {
        const parsed = parsePRUrlOrRef(data.url);
        if (parsed) return parsed;
      }
    }
  } catch {
    // Ignorer si gh n'est pas disponible ou pas dans une PR active
  }

  throw new Error(
    "Impossible de détecter la Pull Request automatiquement. Veuillez fournir l'URL GitHub de la PR (ex: https://github.com/owner/repo/pull/123) ou son identifiant (ex: owner/repo#123)."
  );
}

export function resolvePRTarget(input?: string): PRTarget {
  if (!input || input.trim() === '') {
    return detectLocalGitPR();
  }

  const parsed = parsePRUrlOrRef(input);
  if (parsed) {
    return parsed;
  }

  // Cas où un simple numéro de PR est passé
  const pureNumber = parseInt(input.trim(), 10);
  if (!isNaN(pureNumber) && /^\d+$/.test(input.trim())) {
    return detectLocalGitPR(pureNumber);
  }

  throw new Error(
    `Format de cible de PR invalide: "${input}". Utilisez le format https://github.com/owner/repo/pull/123 ou owner/repo#123.`
  );
}
