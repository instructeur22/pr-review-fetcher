import { describe, expect, it } from 'bun:test';
import { isDeepSourceComment, parseDeepSourceComment } from '../../src/parsers/deepsource-parser';

describe('DeepSource Parser - Détection, Sévérité et Nettoyage HTML', () => {
  describe('isDeepSourceComment', () => {
    it('identifie deepsource par son login ou marqueur', () => {
      expect(isDeepSourceComment('deepsource-io[bot]', 'Issue found')).toBe(true);
      expect(isDeepSourceComment('deepsource-autofix[bot]', 'Issue found')).toBe(true);
      expect(isDeepSourceComment('deepsource-fan', 'Issue found')).toBe(false);
      expect(isDeepSourceComment('not-deepsource', 'Issue found')).toBe(false);
      expect(
        isDeepSourceComment('generic-bot', '<!-- DeepSource: id=123 -->', true)
      ).toBe(true);
      expect(isDeepSourceComment('alice', '<!-- DeepSource: id=123 -->', false)).toBe(false);
    });
  });

  describe('Extraction de la sévérité, du titre et de la catégorie', () => {
    it('extrait le titre dans <h3> et la sévérité P2 depuis les badges SVG major', () => {
      const body = `<!-- DeepSource: id=Q2hlY2tJc3N1ZTp2dm13cG9weHI= -->
<h3><picture>
<source media="(prefers-color-scheme: dark)" srcset="https://static.deepsource.com/comment_artifacts/dark/severity_indicator_major.svg?v=2"/>
<source media="(prefers-color-scheme: light)" srcset="https://static.deepsource.com/comment_artifacts/light/severity_indicator_major.svg?v=2"/>
<img src="https://static.deepsource.com/comment_artifacts/light/severity_indicator_major.svg?v=2" height="14" hspace="8"/>
</picture>List item 0 has incompatible type "str | None"; expected "str | bytes | PathLike[str] | PathLike[bytes]"</h3>
<div><picture>
<source media="(prefers-color-scheme: dark)" srcset="https://static.deepsource.com/comment_artifacts/dark/severity_major.svg?v=2"/>
<source media="(prefers-color-scheme: light)" srcset="https://static.deepsource.com/comment_artifacts/light/severity_major.svg?v=2"/>
<img src="https://static.deepsource.com/comment_artifacts/light/severity_major.svg?v=2" height="20"/>
</picture><picture>
<source media="(prefers-color-scheme: dark)" srcset="https://static.deepsource.com/comment_artifacts/dark/category_typecheck.svg?v=2"/>
<source media="(prefers-color-scheme: light)" srcset="https://static.deepsource.com/comment_artifacts/light/category_typecheck.svg?v=2"/>
<img src="https://static.deepsource.com/comment_artifacts/light/category_typecheck.svg?v=2" height="20" hspace="12"/>
</picture></div>

<br/>

Type given is not compatible. See the issue message for more details.`;

      const res = parseDeepSourceComment(body);
      expect(res.metadata.botName).toBe('deepsource');
      expect(res.metadata.severity).toBe('P2');
      expect(res.metadata.rawCategory).toBe('typecheck');
      expect(res.metadata.title).toBe(
        'List item 0 has incompatible type "str | None"; expected "str | bytes | PathLike[str] | PathLike[bytes]"'
      );
      expect(res.explanation).toBe('Type given is not compatible. See the issue message for more details.');
      expect(res.explanation).not.toContain('<picture>');
      expect(res.explanation).not.toContain('<h3>');
      expect(res.explanation).not.toContain('<div>');
    });

    it('détecte la sévérité P1 pour les badges critical', () => {
      const body = `<h3><picture><img src="https://static.deepsource.com/comment_artifacts/light/severity_indicator_critical.svg"/></picture>SQL Injection vulnerability</h3>\nExplication.`;
      const res = parseDeepSourceComment(body);
      expect(res.metadata.severity).toBe('P1');
      expect(res.metadata.title).toBe('SQL Injection vulnerability');
    });

    it('détecte la sévérité P3 pour les badges minor ou info', () => {
      const body = `<h3><picture><img src="https://static.deepsource.com/comment_artifacts/light/severity_indicator_minor.svg"/></picture>Unused import</h3>\nExplication.`;
      const res = parseDeepSourceComment(body);
      expect(res.metadata.severity).toBe('P3');
      expect(res.metadata.title).toBe('Unused import');
    });
  });
});
