import { describe, expect, it } from 'bun:test';
import { extractCodeModifications } from '../../src/parsers/suggestion-parser';

describe('Suggestion Parser - Modifications de code et suppressions', () => {
  it('extrait une suggestion de suppression de code (bloc suggestion vide)', () => {
    // GitHub représente la suppression de lignes par un bloc suggestion vide
    const body = `Cette ligne est redondante et doit être supprimée :
\`\`\`suggestion
\`\`\`
Merci !`;

    const mods = extractCodeModifications(body, 42, 40);
    expect(mods.length).toBe(1);
    expect(mods[0].type).toBe('suggestion');
    expect(mods[0].content).toBe('');
    expect(mods[0].startLine).toBe(40);
    expect(mods[0].endLine).toBe(42);
  });

  it('extrait une suggestion multiligne avec indentation préservée', () => {
    const body = `Remplacer par la logique sécurisée :
\`\`\`suggestion
    const sanitized = sanitize(input);
    if (!sanitized) {
      return null;
    }
\`\`\`
Fin.`;

    const mods = extractCodeModifications(body, 105, 100);
    expect(mods.length).toBe(1);
    expect(mods[0].type).toBe('suggestion');
    expect(mods[0].content).toBe('    const sanitized = sanitize(input);\n    if (!sanitized) {\n      return null;\n    }');
    expect(mods[0].startLine).toBe(100);
    expect(mods[0].endLine).toBe(105);
  });

  it('extrait plusieurs blocs de suggestion dans un seul commentaire', () => {
    const body = `Première modif :
\`\`\`suggestion
const a = 1;
\`\`\`
Seconde modif :
\`\`\`suggestion
const b = 2;
\`\`\`
C'est tout.`;

    const mods = extractCodeModifications(body, 20, 20);
    expect(mods.length).toBe(2);
    expect(mods[0].content).toBe('const a = 1;');
    expect(mods[1].content).toBe('const b = 2;');
  });

  it("extrait les blocs diff si aucune suggestion GitHub standard n'est présente", () => {
    const body = `Voici le diff proposé :
\`\`\`diff
- oldFunction();
+ newFunction();
\`\`\``;

    const mods = extractCodeModifications(body, 50, 48);
    expect(mods.length).toBe(1);
    expect(mods[0].type).toBe('diff');
    expect(mods[0].content).toBe('- oldFunction();\n+ newFunction();');
    expect(mods[0].startLine).toBe(48);
    expect(mods[0].endLine).toBe(50);
  });

  it('donne la priorité aux blocs suggestion sur les blocs diff', () => {
    const body = `\`\`\`suggestion
const x = 10;
\`\`\`
Exemple de diff indicatif :
\`\`\`diff
- const x = 5;
+ const x = 10;
\`\`\``;

    const mods = extractCodeModifications(body, 12);
    expect(mods.length).toBe(1);
    expect(mods[0].type).toBe('suggestion');
    expect(mods[0].content).toBe('const x = 10;');
  });

  it('gère correctement les lignes manquantes ou mono-lignes', () => {
    const body = `\`\`\`suggestion
return true;
\`\`\``;

    const modSingle = extractCodeModifications(body, 30);
    expect(modSingle[0].startLine).toBe(30);
    expect(modSingle[0].endLine).toBe(30);

    const modNone = extractCodeModifications(body);
    expect(modNone[0].startLine).toBeUndefined();
    expect(modNone[0].endLine).toBeUndefined();
  });
});
