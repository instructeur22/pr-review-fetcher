import { PRTarget } from './types';

export function resolveAuthToken(explicitToken?: string): string | undefined {
  if (explicitToken && explicitToken.trim() !== '') {
    return explicitToken.trim();
  }

  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim() !== '') {
    return process.env.GITHUB_TOKEN.trim();
  }

  if (process.env.GH_TOKEN && process.env.GH_TOKEN.trim() !== '') {
    return process.env.GH_TOKEN.trim();
  }

  // Tenter de récupérer le token depuis GitHub CLI (gh)
  try {
    const proc = Bun.spawnSync(['gh', 'auth', 'token'], {
      stdout: 'pipe',
      stderr: 'ignore',
      stdin: 'ignore',
      timeout: 5000
    });
    if (proc.exitCode === 0) {
      const token = proc.stdout.toString().trim();
      if (token.length > 0) {
        return token;
      }
    }
  } catch {
    // gh non installé ou non connecté
  }

  return undefined;
}

export interface RawPRDetails {
  title: string;
  body: string | null;
  state: string;
  user: { login: string };
  head: { ref: string; sha: string };
  base: { ref: string };
  html_url: string;
}

export interface RawReviewComment {
  id: number;
  pull_request_review_id?: number;
  diff_hunk: string;
  path: string;
  position?: number | null;
  original_position?: number | null;
  commit_id?: string;
  user: { login: string; type?: string; avatar_url?: string };
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  line?: number | null;
  original_line?: number | null;
  start_line?: number | null;
  original_start_line?: number | null;
  side?: string;
  start_side?: string;
  in_reply_to_id?: number;
}

export class GitHubClient {
  private token?: string;
  private baseUrl = 'https://api.github.com';

  constructor(token?: string) {
    this.token = resolveAuthToken(token);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'pr-review-fetcher-cli'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(path: string): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(30000)
      });
    } catch (err: any) {
      if (err?.name === 'TimeoutError') {
        throw new Error(`Délai d'attente dépassé (30s) lors de la requête vers GitHub API (${url}).`);
      }
      throw err;
    }

    if (!res.ok) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      const reset = res.headers.get('x-ratelimit-reset');
      const retryAfter = res.headers.get('retry-after');

      let responseBodyMessage = '';
      try {
        const data = (await res.json()) as { message?: string };
        if (data && typeof data.message === 'string') {
          responseBodyMessage = data.message;
        }
      } catch {
        // Ignorer si la réponse n'est pas du JSON valide
      }

      const isSecondaryRateLimit =
        res.status === 403 &&
        (Boolean(retryAfter) ||
          responseBodyMessage.toLowerCase().includes('secondary rate limit') ||
          responseBodyMessage.toLowerCase().includes('abuse detection'));

      // Gestion des quotas primaires et secondaires (429 ou 403 épuisé / secondary rate limit)
      if ((res.status === 403 && (remaining === '0' || isSecondaryRateLimit)) || res.status === 429) {
        const delayMsg = retryAfter
          ? `veuillez réessayer dans ${retryAfter} seconde(s)`
          : reset
          ? `réinitialisation à ${new Date(parseInt(reset, 10) * 1000).toLocaleTimeString()}`
          : 'bientôt';

        const rateType = isSecondaryRateLimit || res.status === 429 ? 'secondaire ' : '';
        throw new Error(
          `Limite de requêtes GitHub API ${rateType}atteinte (${delayMsg}).\n` +
          `Astuce : Fournissez un token d'accès avec l'option --token <token> ou connectez-vous avec 'gh auth login' pour bénéficier de 5000 requêtes/heure.`
        );
      }

      if (res.status === 404) {
        throw new Error(
          `Ressource introuvable sur GitHub (${url}).\n` +
          `Vérifiez que le dépôt et la PR existent. Si le dépôt est privé, assurez-vous de passer un token valide avec --token.`
        );
      }

      if (res.status === 401) {
        throw new Error(`Token GitHub invalide ou expiré (401 Unauthorized).`);
      }

      let errorMsg = `Erreur GitHub API (${res.status} ${res.statusText})`;
      if (responseBodyMessage) {
        errorMsg += `: ${responseBodyMessage}`;
      }
      throw new Error(errorMsg);
    }

    return (await res.json()) as T;
  }

  async getPullRequest(target: PRTarget): Promise<RawPRDetails> {
    return this.request<RawPRDetails>(`/repos/${target.owner}/${target.repo}/pulls/${target.pullNumber}`);
  }

  async getReviewComments(target: PRTarget): Promise<RawReviewComment[]> {
    const comments: RawReviewComment[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const chunk = await this.request<RawReviewComment[]>(
        `/repos/${target.owner}/${target.repo}/pulls/${target.pullNumber}/comments?per_page=${perPage}&page=${page}`
      );
      comments.push(...chunk);
      if (chunk.length < perPage || page >= 10) {
        if (chunk.length >= perPage && page >= 10) {
          console.warn(`\x1b[33mAvertissement :\x1b[0m La PR contient plus de 1000 commentaires. L'extraction a été plafonnée.`);
        }
        break;
      }
      page++;
    }

    return comments;
  }
}
