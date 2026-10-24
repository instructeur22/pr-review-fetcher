import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { GitHubClient, resolveAuthToken } from '../src/github-client';
import { PRTarget } from '../src/types';

describe('GitHub Client - Authentification, Quotas et Erreurs', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  describe('resolveAuthToken', () => {
    it("donne priorité au token explicite passé en argument", () => {
      process.env.GITHUB_TOKEN = 'env-token';
      expect(resolveAuthToken('explicit-token')).toBe('explicit-token');
    });

    it("utilise GITHUB_TOKEN si aucun token explicite n'est fourni", () => {
      process.env.GITHUB_TOKEN = 'token-env';
      delete process.env.GH_TOKEN;
      expect(resolveAuthToken()).toBe('token-env');
    });

    it('utilise GH_TOKEN en second recours', () => {
      delete process.env.GITHUB_TOKEN;
      process.env.GH_TOKEN = 'gh-token-env';
      expect(resolveAuthToken()).toBe('gh-token-env');
    });
  });

  describe('Gestion des quotas et erreurs API', () => {
    const mockTarget: PRTarget = {
      owner: 'acme',
      repo: 'widget',
      pullNumber: 10,
      url: 'https://github.com/acme/widget/pull/10'
    };

    it("lève une exception claire lors d'un 403 avec x-ratelimit-remaining=0", async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
          status: 403,
          statusText: 'Forbidden',
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1725555000'
          }
        });
      }) as unknown as typeof fetch;

      const client = new GitHubClient();
      await expect(client.getPullRequest(mockTarget)).rejects.toThrow(
        /Limite de requêtes GitHub API atteinte/
      );
    });

    it("gère l'erreur 401 Unauthorized", async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ message: 'Bad credentials' }), {
          status: 401,
          statusText: 'Unauthorized'
        });
      }) as unknown as typeof fetch;

      const client = new GitHubClient('invalid-token');
      await expect(client.getPullRequest(mockTarget)).rejects.toThrow(
        /Token GitHub invalide ou expiré/
      );
    });

    it('gère les codes HTTP 429 (Secondary Rate Limit)', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({ message: 'You have exceeded a secondary rate limit.' }),
          { status: 429, statusText: 'Too Many Requests' }
        );
      }) as unknown as typeof fetch;

      const client = new GitHubClient('token');
      await expect(client.getPullRequest(mockTarget)).rejects.toThrow(
        /Limite de requêtes GitHub API/
      );
    });

    it('gère les codes HTTP 403 avec message de limite secondaire et remaining > 0', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({ message: 'You have exceeded a secondary rate limit. Please wait a few minutes.' }),
          {
            status: 403,
            statusText: 'Forbidden',
            headers: {
              'x-ratelimit-remaining': '4990',
              'retry-after': '60'
            }
          }
        );
      }) as unknown as typeof fetch;

      const client = new GitHubClient('token');
      await expect(client.getPullRequest(mockTarget)).rejects.toThrow(
        /Limite de requêtes GitHub API secondaire atteinte \(veuillez réessayer dans 60 seconde\(s\)\)/
      );
    });
  });
});
