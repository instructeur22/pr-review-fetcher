import { describe, expect, it } from 'bun:test';
import { isGreptileComment, parseGreptileComment } from '../src/parsers/greptile-parser';
import { isCodeRabbitComment, parseCodeRabbitComment } from '../src/parsers/coderabbit-parser';
import { extractCodeModifications } from '../src/parsers/suggestion-parser';
import { parsePRUrlOrRef } from '../src/pr-resolver';

describe('PR Resolver', () => {
  it('parse une URL GitHub complète', () => {
    const target = parsePRUrlOrRef('https://github.com/astral-sh/uv/pull/1234');
    expect(target).toEqual({
      owner: 'astral-sh',
      repo: 'uv',
      pullNumber: 1234,
      url: 'https://github.com/astral-sh/uv/pull/1234'
    });
  });

  it('parse un format court owner/repo#number', () => {
    const target = parsePRUrlOrRef('facebook/react#42');
    expect(target).toEqual({
      owner: 'facebook',
      repo: 'react',
      pullNumber: 42,
      url: 'https://github.com/facebook/react/pull/42'
    });
  });

  it('nettoie le suffixe .git dans un format court owner/repo.git#number', () => {
    const target = parsePRUrlOrRef('facebook/react.git#42');
    expect(target).toEqual({
      owner: 'facebook',
      repo: 'react',
      pullNumber: 42,
      url: 'https://github.com/facebook/react/pull/42'
    });
  });

  it('retourne null pour une chaîne invalide', () => {
    const target = parsePRUrlOrRef('invalid-string');
    expect(target).toBeNull();
  });
});

describe('Greptile Parser', () => {
  const greptileBodyFromImage = `P1 Marqueur de commentaire non authentifié

\`upsertTriageComment\` sélectionne le premier commentaire dont le corps contient \`TRIAGE_MARKER\`, sans vérifier qu'il appartient au bot de triage. Sur une issue sans commentaire de triage existant, un contributeur peut publier ce marqueur dans son propre commentaire : le prochain triage appelle alors \`updateComment\` avec l'identifiant de ce commentaire et en remplace le contenu. Restreignez la recherche au commentaire de l'identité GitHub de l'automatisation, en plus du marqueur ; créez un nouveau commentaire lorsqu'aucun commentaire appartenant au bot n'est trouvé.

<details>
<summary>Artifacts</summary>
- security_scan_result.json
- triage_ast_dump.txt
</details>`;

  it('identifie correctement le bot greptile', () => {
    expect(isGreptileComment('greptile-apps', greptileBodyFromImage)).toBe(true);
    expect(isGreptileComment('greptile-apps[bot]', 'Hello')).toBe(true);
  });

  it('extrait la sévérité P1, le titre et les artefacts', () => {
    const parsed = parseGreptileComment(greptileBodyFromImage);
    expect(parsed.metadata.botName).toBe('greptile');
    expect(parsed.metadata.severity).toBe('P1');
    expect(parsed.metadata.title).toBe('Marqueur de commentaire non authentifié');
    expect(parsed.explanation).toContain('upsertTriageComment');
    expect(parsed.metadata.artifacts).toEqual([
      'security_scan_result.json',
      'triage_ast_dump.txt'
    ]);
  });
});

describe('CodeRabbit Parser', () => {
  it('identifie coderabbit et extrait le titre', () => {
    const body = `### Refactorisation requise
Le pattern utilisé présente un risque de memory leak.
\`\`\`suggestion
const clean = true;
\`\`\`
<!-- Commitable suggestion -->`;
    expect(isCodeRabbitComment('coderabbitai[bot]', body)).toBe(true);
    const parsed = parseCodeRabbitComment(body);
    expect(parsed.metadata.botName).toBe('coderabbit');
    expect(parsed.metadata.title).toBe('Refactorisation requise');
    expect(parsed.explanation).toContain('Le pattern utilisé présente un risque de memory leak.');
  });
});

describe('Suggestion Parser', () => {
  it('extrait les blocs de suggestions GitHub markdown', () => {
    const body = `Voici le code corrigé :
\`\`\`suggestion
const existing = comments.find(
  (comment) => comment.user?.login === BOT_NAME && comment.body.includes(TRIAGE_MARKER)
);
\`\`\`
Et voilà.`;

    const mods = extractCodeModifications(body, 530, 528);
    expect(mods.length).toBe(1);
    expect(mods[0].type).toBe('suggestion');
    expect(mods[0].startLine).toBe(528);
    expect(mods[0].endLine).toBe(530);
    expect(mods[0].content).toContain('BOT_NAME');
  });
});
