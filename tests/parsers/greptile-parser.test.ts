import { describe, expect, it } from 'bun:test';
import { isGreptileComment, parseGreptileComment } from '../../src/parsers/greptile-parser';

describe('Greptile Parser - Détection et Extraction Forensique', () => {
  describe('isGreptileComment', () => {
    it("détecte le bot par son nom d'auteur standard ou avec suffixe [bot]", () => {
      expect(isGreptileComment('greptile-apps', 'commentaire quelconque')).toBe(true);
      expect(isGreptileComment('greptile-apps[bot]', 'autre commentaire')).toBe(true);
      expect(isGreptileComment('my-greptile-integration', 'hello')).toBe(true);
    });

    it('détecte un bot par marqueur P0-P3 et Artifacts UNIQUEMENT si isBot est vrai', () => {
      const bodyWithMarker = "P1 Risque d'injection\n<details><summary>Artifacts</summary>- log.txt</details>";
      expect(isGreptileComment('custom-bot', bodyWithMarker, true)).toBe(true);
      // Immunité faux positif : un utilisateur humain discutant d'un rapport Greptile
      expect(isGreptileComment('john_contributor', bodyWithMarker, false)).toBe(false);
    });

    it('ignore les commentaires normaux sans marqueur greptile', () => {
      expect(isGreptileComment('alice', 'LGTM!')).toBe(false);
      expect(isGreptileComment('bob', 'P1 is high priority', true)).toBe(false);
      expect(isGreptileComment('greptile-fan', 'commentaire quelconque')).toBe(false);
      expect(isGreptileComment('my-greptile', 'commentaire quelconque')).toBe(false);
    });
  });

  describe('Détection de la sévérité (P0 à P3)', () => {
    it('détecte P0 (bloquant / incident)', () => {
      const body = 'P0 Panne critique du service de build\nExplication détaillée ici.';
      const res = parseGreptileComment(body);
      expect(res.metadata.severity).toBe('P0');
      expect(res.metadata.title).toBe('Panne critique du service de build');
      expect(res.explanation).toBe('Explication détaillée ici.');
    });

    it('détecte P1 avec formatage markdown gras **P1**', () => {
      const body = '**P1**: Faille de sécurité XSS détectée\nSanitisez les entrées.';
      const res = parseGreptileComment(body);
      expect(res.metadata.severity).toBe('P1');
      expect(res.metadata.title).toBe('Faille de sécurité XSS détectée');
      expect(res.explanation).toBe('Sanitisez les entrées.');
    });

    it('détecte P2 avec formatage crochets [P2]', () => {
      const body = '[P2] - Performance dégradée dans la boucle\nUtilisez un Set.';
      const res = parseGreptileComment(body);
      expect(res.metadata.severity).toBe('P2');
      expect(res.metadata.title).toBe('Performance dégradée dans la boucle');
      expect(res.explanation).toBe('Utilisez un Set.');
    });

    it('détecte P3 avec balise span HTML', () => {
      const body = "<span class=\"badge\">P3</span> : Typo dans la documentation\nCorriger l'orthographe.";
      const res = parseGreptileComment(body);
      expect(res.metadata.severity).toBe('P3');
      expect(res.metadata.title).toBe('Typo dans la documentation');
      expect(res.explanation).toBe("Corriger l'orthographe.");
    });

    it('ne reconnaît pas P4 ou des formats invalides comme sévérité', () => {
      const body = 'P4 Problème cosmétique mineur\nJuste une idée.';
      const res = parseGreptileComment(body);
      expect(res.metadata.severity).toBeUndefined();
      expect(res.metadata.title).toBeUndefined();
      expect(res.explanation).toBe(body.trim());
    });
  });

  describe("Extraction d'artefacts isolés et sections <details> multiples", () => {
    it('extrait les artefacts au format puces tirets ou astérisques', () => {
      const body = `P1 Fuite mémoire
Détails de la fuite.
<details>
<summary>Artifacts</summary>
- heap_dump.bin
* valgrind_output.log
</details>`;
      const res = parseGreptileComment(body);
      expect(res.metadata.artifacts).toEqual(['heap_dump.bin', 'valgrind_output.log']);
    });

    it('isole la section Artifacts sans englober les sections <details> précédentes (Correctif Forensique)', () => {
      const body = `P1 Erreur de configuration
Description de l'anomalie.

<details>
<summary>Diagnostic préliminaire</summary>
Données de diagnostic système qui ne doivent PAS être dans les artefacts.
</details>

<details>
<summary>Artifacts</summary>
- report_trace.json
- coverage.xml
</details>`;

      const res = parseGreptileComment(body);
      // Vérification 1 : Les artefacts ne contiennent QUE la section Artifacts
      expect(res.metadata.artifacts).toEqual(['report_trace.json', 'coverage.xml']);
      // Vérification 2 : L'explication préserve la section de diagnostic précédente
      expect(res.explanation).toContain('<summary>Diagnostic préliminaire</summary>');
      expect(res.explanation).toContain('Données de diagnostic système qui ne doivent PAS être dans les artefacts.');
      // Vérification 3 : L'explication ne contient plus la section Artifacts
      expect(res.explanation).not.toContain('<summary>Artifacts</summary>');
    });

    it('retourne undefined pour artifacts si la section Artifacts est absente ou vide', () => {
      const bodyNoArt = "P2 Légère incohérence\nPas d'artefact joint.";
      expect(parseGreptileComment(bodyNoArt).metadata.artifacts).toBeUndefined();

      const bodyEmptyArt = `P2 Légère incohérence\n<details><summary>Artifacts</summary>\n\n</details>`;
      expect(parseGreptileComment(bodyEmptyArt).metadata.artifacts).toBeUndefined();
    });

    it('extrait le badge image P1, le titre en gras, les artefacts T-Rex avec summary strong et nettoie le boilerplate', () => {
      const body = `<a href="#"><img alt="P1" src="https://greptile-static-assets.s3.amazonaws.com/badges/p1.svg?v=9" align="top"></a> **Trusted lookup breaks existing \`which\` doubles**

\`_find_trusted_bin\` now calls \`shutil.which\` with \`path=\`, but the subprocess-related tests replace it with one-argument callables. Calling this helper therefore raises \`TypeError\` before those tests reach their assertions, including the mocks in \`tests/test_package.py\`. Update those test doubles to accept the \`path\` argument while retaining the explicit trusted-path lookup.

<details><summary><strong>Artifacts</strong></summary><br />

**[Focused Python reproduction using a one-argument shutil.which double](https://app.greptile.com/trex/artifacts/ef80fc2d-35c8-4f60-8fa9-5764a1561831)**

- The executed reproduction imports the server, installs a one-argument \`shutil.which\` replacement, and runs comparable before and changed-helper paths; it defines the condition tested and the takeaway is that the changed helper receives the incompatible double.

<a href="https://app.greptile.com/trex/runs/21398525/artifacts?artifact=ef80fc2d-35c8-4f60-8fa9-5764a1561831"><picture><img alt="View artifacts" src="https://greptile-static-assets.s3.amazonaws.com/badges/ViewArtifacts.svg?v=4"></picture></a>
</details>

<sub><a href="https://www.greptile.com/trex"><img alt="T-Rex" src="https://greptile-static-assets.s3.amazonaws.com/trex/trex_green.svg" height="14" align="absmiddle"></a> Ran code and verified through T-Rex</sub>

<details><summary>Prompt To Fix With AI</summary>
This is a comment left during a code review.
</details>

<a href="https://app.greptile.com/ide/claude-code?prompt=test"><picture><img alt="Fix in Claude Code" src="https://greptile-static-assets.s3.amazonaws.com/badges/FixInClaude.svg?v=6"></picture></a>`;

      const res = parseGreptileComment(body);
      expect(res.metadata.severity).toBe('P1');
      expect(res.metadata.title).toBe('Trusted lookup breaks existing `which` doubles');
      expect(res.metadata.artifacts).toBeDefined();
      expect(res.metadata.artifacts?.length).toBe(1);
      expect(res.metadata.artifacts?.[0]).toContain('https://app.greptile.com/trex/artifacts/ef80fc2d-35c8-4f60-8fa9-5764a1561831');
      expect(res.metadata.artifacts?.[0]).toContain('Focused Python reproduction');
      expect(res.metadata.artifacts?.[0]).toContain('The executed reproduction imports the server');
      expect(res.explanation).toBe(
        '`_find_trusted_bin` now calls `shutil.which` with `path=`, but the subprocess-related tests replace it with one-argument callables. Calling this helper therefore raises `TypeError` before those tests reach their assertions, including the mocks in `tests/test_package.py`. Update those test doubles to accept the `path` argument while retaining the explicit trusted-path lookup.'
      );
      expect(res.explanation).not.toContain('Artifacts');
      expect(res.explanation).not.toContain('Prompt To Fix With AI');
      expect(res.explanation).not.toContain('Ran code and verified through T-Rex');
    });
  });
});

