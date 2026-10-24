import { describe, expect, it } from 'bun:test';
import { formatAgentXML, sanitizeXmlChars } from '../src/formatters/xml-agent-formatter';
import { PRReviewReport } from '../src/types';

describe('XML Agent Formatter - Conformité XML 1.0 et CDATA', () => {
  const mockReport: PRReviewReport = {
    target: {
      owner: 'acme-inc',
      repo: 'web-platform',
      pullNumber: 99,
      url: 'https://github.com/acme-inc/web-platform/pull/99'
    },
    title: 'Fix issue triage security',
    author: 'alice',
    state: 'open',
    body: 'Description of PR',
    head: 'feature-triage',
    base: 'main',
    totalComments: 1,
    fetchedAt: '2026-09-05T17:00:00.000Z',
    comments: [
      {
        id: 98765,
        path: '.github/scripts/triage_issue.cjs',
        line: 530,
        startLine: 528,
        side: 'RIGHT',
        author: 'greptile-apps',
        isBot: true,
        botMetadata: {
          botName: 'greptile',
          severity: 'P1',
          title: 'Marqueur de commentaire non authentifié',
          artifacts: ['trace.log']
        },
        diffHunk: '@@ -528,3 +528,3 @@\n+ const existing = comments.find(...)',
        codeContext: '528 + const existing = comments.find(...)',
        body: 'Explication...',
        explanation: 'upsertTriageComment sélectionne le premier commentaire...',
        modifications: [
          {
            type: 'suggestion',
            content: 'const safe = true;',
            startLine: 528,
            endLine: 530
          }
        ],
        url: 'https://github.com/acme-inc/web-platform/pull/99#discussion_r98765',
        createdAt: '2026-09-05T16:45:00Z'
      }
    ]
  };

  it('génère un XML valide et bien structuré avec toutes les balises requises', () => {
    const xml = formatAgentXML(mockReport);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<pr_review_report pr_number="99" repo="acme-inc/web-platform"');
    expect(xml).toContain('<title>Fix issue triage security</title>');
    expect(xml).toContain('<reviews count="1">');
    expect(xml).toContain('<review_comment id="98765" file=".github/scripts/triage_issue.cjs" start_line="528" end_line="530" side="RIGHT">');
    expect(xml).toContain('<severity>P1</severity>');
    expect(xml).toContain('<artifact>trace.log</artifact>');
    expect(xml).toContain('<![CDATA[@@ -528,3 +528,3 @@');
    expect(xml).toContain('<code_context><![CDATA[528 + const existing = comments.find(...)]]></code_context>');
    expect(xml).toContain('<![CDATA[const safe = true;]]>');
  });

  describe('sanitizeXmlChars', () => {
    it('élimine les caractères de contrôle non autorisés en XML 1.0 (\\x00-\\x08, \\x0B, \\x0C, \\x0E-\\x1F)', () => {
      const input = 'Texte\x00avec\x07caractères\x08invalides\x1B[31mANSI\x1B[0m\x0Cet\x1Ffin';
      const clean = sanitizeXmlChars(input);
      expect(clean).toBe('Texteaveccaractèresinvalides[31mANSI[0metfin');
      expect(clean).not.toContain('\x00');
      expect(clean).not.toContain('\x1B');
    });

    it("préserve les caractères d'espacement légaux en XML 1.0 (\\t, \\n, \\r)", () => {
      const input = "Ligne 1\r\n\tIndentation tab\nLigne 2";
      expect(sanitizeXmlChars(input)).toBe(input);
    });

    it('préserve les émojis UTF-16 et symboles du plan astral (ex: 🔒, 🔴, 🟠, ⚡, 🏗️, 🤖, 🔎)', () => {
      const input = '_🔒 Security & Privacy_ | _🔴 Critical_ | _🟠 Major_ | _⚡ Quick win_ | _🏗️ Heavy lift_ | 🤖 | 🔎';
      expect(sanitizeXmlChars(input)).toBe(input);
    });
  });

  describe('Conformité CDATA et échappement de ]]>', () => {
    it('échappe la séquence ]]> dans les explications et diffs pour ne pas casser le CDATA', () => {
      const dangerousReport: PRReviewReport = {
        ...mockReport,
        comments: [
          {
            ...mockReport.comments[0],
            explanation: 'Attention à la condition arr[index]]> !',
            diffHunk: 'if (val]]>) return;',
            modifications: [
              {
                type: 'suggestion',
                content: 'const safe = arr[i]]>;'
              }
            ]
          }
        ]
      };

      const xml = formatAgentXML(dangerousReport);
      // La séquence ]]> doit être découpée en ]]]]><![CDATA[>
      expect(xml).toContain('arr[index]]]]><![CDATA[> !');
      expect(xml).toContain('if (val]]]]><![CDATA[>) return;');
      expect(xml).toContain('arr[i]]]]><![CDATA[>;');
    });
  });

  describe('Structure des attributs de lignes', () => {
    it('omet start_line et end_line pour les commentaires de portée fichier', () => {
      const fileLevelReport: PRReviewReport = {
        ...mockReport,
        comments: [
          {
            ...mockReport.comments[0],
            startLine: undefined,
            line: undefined,
            modifications: []
          }
        ]
      };
      const xml = formatAgentXML(fileLevelReport);
      expect(xml).toContain(`<review_comment id="${mockReport.comments[0].id}" file="${mockReport.comments[0].path}" side="RIGHT">`);
      expect(xml).not.toContain('start_line=');
      expect(xml).not.toContain('end_line=');
    });
  });
});
