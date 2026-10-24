import { describe, expect, it } from 'bun:test';
import { processReviewComments } from '../src/comment-processor';
import { PRTarget } from '../src/types';
import { RawPRDetails, RawReviewComment } from '../src/github-client';

describe('Comment Processor - Hiérarchie, Tri et Détection des Bots', () => {
  const mockTarget: PRTarget = {
    owner: 'octocat',
    repo: 'Hello-World',
    pullNumber: 42,
    url: 'https://github.com/octocat/Hello-World/pull/42'
  };

  const mockPRDetails: RawPRDetails = {
    title: 'Update greeting logic',
    body: 'Refactoring greetings for localization',
    state: 'open',
    user: { login: 'alice' },
    head: { ref: 'feature-branch', sha: 'abc123' },
    base: { ref: 'main' },
    html_url: 'https://github.com/octocat/Hello-World/pull/42'
  };

  it('traite correctement un commentaire Greptile avec sévérité et artefacts', () => {
    const rawComments: RawReviewComment[] = [
      {
        id: 1001,
        path: 'src/greet.ts',
        line: 25,
        start_line: 20,
        side: 'RIGHT',
        user: { login: 'greptile-apps', type: 'Bot' },
        diff_hunk: '@@ -20,6 +20,6 @@',
        body: `P1 Risque d'injection SQL
Paramétrez la requête de message.
<details>
<summary>Artifacts</summary>
- sql_ast.json
</details>`,
        created_at: '2026-09-05T10:00:00Z',
        updated_at: '2026-09-05T10:00:00Z',
        html_url: 'https://github.com/octocat/Hello-World/pull/42#discussion_r1001'
      }
    ];

    const report = processReviewComments(mockTarget, mockPRDetails, rawComments);
    expect(report.comments.length).toBe(1);

    const c = report.comments[0];
    expect(c.isBot).toBe(true);
    expect(c.botMetadata?.botName).toBe('greptile');
    expect(c.botMetadata?.severity).toBe('P1');
    expect(c.botMetadata?.artifacts).toEqual(['sql_ast.json']);
    expect(c.diffHunk).toBeDefined();
    expect(c.rawDiffHunk).toBe('@@ -20,6 +20,6 @@');
  });

  it('extrait et stocke le codeContext et le diffHunk focalisé à partir du diff_hunk brut', () => {
    const rawComments: RawReviewComment[] = [
      {
        id: 2001,
        path: 'src/auth.ts',
        line: 52,
        user: { login: 'coderabbitai[bot]', type: 'Bot' },
        diff_hunk: `@@ -40,15 +40,15 @@
 function authenticate() {
+  const a = 1;
+  const b = 2;
+  const c = 3;
+  const d = 4;
+  const e = 5;
+  const token = verify();
+  return token;`,
        body: 'Vérifiez la signature du token',
        created_at: '2026-09-05T10:00:00Z',
        updated_at: '2026-09-05T10:00:00Z',
        html_url: ''
      }
    ];

    const report = processReviewComments(mockTarget, mockPRDetails, rawComments);
    const comment = report.comments[0];
    expect(comment.rawDiffHunk).toContain('function authenticate()');
    expect(comment.diffHunk).not.toContain('function authenticate()');
    expect(comment.diffHunk).toContain('const token = verify();');
    expect(comment.codeContext).toContain('token = verify()');
  });

  it('trie les commentaires par fichier puis par numéro de ligne', () => {
    const rawComments: RawReviewComment[] = [
      { id: 3, path: 'src/z.ts', line: 10, user: { login: 'alice' }, diff_hunk: '', body: 'Z10', created_at: '', updated_at: '', html_url: '' },
      { id: 1, path: 'src/a.ts', line: 50, user: { login: 'alice' }, diff_hunk: '', body: 'A50', created_at: '', updated_at: '', html_url: '' },
      { id: 2, path: 'src/a.ts', line: 20, user: { login: 'alice' }, diff_hunk: '', body: 'A20', created_at: '', updated_at: '', html_url: '' }
    ];

    const report = processReviewComments(mockTarget, mockPRDetails, rawComments);
    expect(report.comments.map(c => c.body)).toEqual(['A20', 'A50', 'Z10']);
  });

  it('ordonne le fil de discussion en maintenant les réponses après leur commentaire racine', () => {
    const rootComment: RawReviewComment = {
      id: 500,
      path: 'src/controller.ts',
      line: 42,
      user: { login: 'lead-dev' },
      diff_hunk: '@@ -42,1 +42,1 @@',
      body: 'Question sur cette méthode',
      created_at: '2026-09-05T09:00:00Z',
      updated_at: '2026-09-05T09:00:00Z',
      html_url: ''
    };

    const replyComment: RawReviewComment = {
      id: 501,
      path: 'src/controller.ts',
      line: null, // GitHub renvoie null pour les réponses
      in_reply_to_id: 500,
      user: { login: 'contributor' },
      diff_hunk: '@@ -42,1 +42,1 @@',
      body: 'Réponse explicative',
      created_at: '2026-09-05T09:30:00Z',
      updated_at: '2026-09-05T09:30:00Z',
      html_url: ''
    };

    const anotherEarlierComment: RawReviewComment = {
      id: 490,
      path: 'src/controller.ts',
      line: 10,
      user: { login: 'lead-dev' },
      diff_hunk: '',
      body: 'Commentaire sur la ligne 10',
      created_at: '2026-09-05T08:00:00Z',
      updated_at: '2026-09-05T08:00:00Z',
      html_url: ''
    };

    const report = processReviewComments(mockTarget, mockPRDetails, [rootComment, replyComment, anotherEarlierComment]);
    // Vérifie que la réponse (id: 501) ne s'est pas retrouvée au début (ligne 0), mais bien juste après le parent (id: 500)
    expect(report.comments.map(c => c.id)).toEqual([490, 500, 501]);
  });

  it('transmet le diff_hunk, la plage multiligne et le side du root aux réponses de thread', () => {
    const rootComment: RawReviewComment = {
      id: 600,
      path: 'src/api.ts',
      line: 30,
      start_line: 25,
      side: 'RIGHT',
      user: { login: 'reviewer' },
      diff_hunk: '@@ -25,6 +25,6 @@\n+line 25\n+line 26\n+line 27\n+line 28\n+line 29\n+line 30',
      body: 'Attention sur ce bloc',
      created_at: '2026-09-05T09:00:00Z',
      updated_at: '2026-09-05T09:00:00Z',
      html_url: ''
    };

    const replyComment: RawReviewComment = {
      id: 601,
      path: 'src/api.ts',
      line: null,
      start_line: null,
      side: undefined,
      in_reply_to_id: 600,
      user: { login: 'author' },
      diff_hunk: '',
      body: 'Bien noté, je modifie',
      created_at: '2026-09-05T09:15:00Z',
      updated_at: '2026-09-05T09:15:00Z',
      html_url: ''
    };

    const report = processReviewComments(mockTarget, mockPRDetails, [rootComment, replyComment]);
    const reply = report.comments.find(c => c.id === 601);
    expect(reply).toBeDefined();
    expect(reply?.line).toBe(30);
    expect(reply?.startLine).toBe(25);
    expect(reply?.side).toBe('RIGHT');
    expect(reply?.diffHunk).toContain('+line 30');
    expect(reply?.codeContext).toContain('30 + line 30');
  });
});
