import { describe, expect, it } from 'bun:test';
import { sanitizeTerminalText, formatTerminal, formatDiffHunk } from '../../src/formatters/terminal-formatter';
import { PRReviewReport } from '../../src/types';

describe('Terminal Formatter - Neutralisation des séquences de contrôle (CWE-150)', () => {
  it('supprime les séquences OSC de manipulation du presse-papier ou d hyperliens', () => {
    // Séquence OSC 52 (presse-papier) et OSC 8 (hyperlien caché)
    const malicious = 'Explication \x1b]52;c;cGFzc3dvcmQ=\x07normale \x1b]8;;http://evil.com\x1b\\cliquez ici\x1b]8;;\x1b\\ fin';
    const clean = sanitizeTerminalText(malicious);

    expect(clean).not.toContain('\x1b]52');
    expect(clean).not.toContain('\x1b]8');
    expect(clean).not.toContain('\x07');
    expect(clean).toBe('Explication normale cliquez ici fin');
  });

  it('supprime les séquences CSI arbitraires et les caractères de contrôle non imprimables', () => {
    const malicious = 'Attention \x1b[2J\x1b[H\x1b[31;1mtexte rouge\x1b[0m \x00\x07\x1b';
    const clean = sanitizeTerminalText(malicious);

    expect(clean).not.toContain('\x1b[');
    expect(clean).not.toContain('\x00');
    expect(clean).not.toContain('\x07');
    expect(clean).toBe('Attention texte rouge ');
  });

  it('supprime les retours chariot (\\r) et les commandes de contrôle C1 8-bit (\\x80-\\x9f)', () => {
    // \r pour écraser une ligne précédente, \x9b pour CSI 8-bit, \x9d pour OSC 8-bit
    const malicious = 'Texte initial\rÉcrasé\x9b31mrouge\x9d52;c;leak\x07fin\x80\x9f';
    const clean = sanitizeTerminalText(malicious);

    expect(clean).not.toContain('\r');
    expect(clean).not.toContain('\x9b');
    expect(clean).not.toContain('\x9d');
    expect(clean).not.toContain('\x80');
    expect(clean).not.toContain('\x9f');
    expect(clean).toBe('Texte initialÉcrasérougefin');
  });

  it('neutralise les séquences dans formatDiffHunk et formatTerminal', () => {
    const maliciousDiff = '@@ -1,3 +1,3 @@\n- old\n+ new \x1b]52;c;evil\x07';
    const rendered = formatDiffHunk(maliciousDiff);
    expect(rendered).not.toContain('\x1b]52');

    const report: PRReviewReport = {
      target: {
        owner: 'safe-org\x1b]52;c;test\x07',
        repo: 'safe-repo',
        pullNumber: 1,
        url: 'https://github.com/safe-org/safe-repo/pull/1'
      },
      title: 'PR malveillante \x1b[2J',
      author: 'attacker\x1b]8;;evil.com\x07',
      state: 'open',
      body: 'Description de la PR',
      head: 'feature',
      base: 'main',
      totalComments: 1,
      fetchedAt: new Date().toISOString(),
      comments: [
        {
          id: 1,
          path: 'src/index.ts\x1b[31m',
          line: 10,
          author: 'malicious-bot\x1b]52;c;inject\x07',
          isBot: true,
          botMetadata: {
            botName: 'greptile',
            severity: 'P1',
            title: 'Titre avec OSC \x1b]52;c;hack\x07'
          },
          diffHunk: maliciousDiff,
          body: 'Corps',
          explanation: 'Explication avec injection \x1b]52;c;leak\x07',
          modifications: [],
          url: 'https://github.com/safe-org/safe-repo/pull/1#1',
          createdAt: new Date().toISOString()
        }
      ]
    };

    const term = formatTerminal(report);
    // Vérifier qu'aucune séquence OSC malveillante n'a survécu
    expect(term).not.toContain('\x1b]52');
    expect(term).not.toContain('\x1b]8');
  });

  it('traite les séquences non terminées en O(N) sans blocage ni ReDoS', () => {
    // Séquence OSC non terminée avec une grande charge utile
    const largeUnterminated = '\x1b]' + 'A'.repeat(50000);
    const start = performance.now();
    const clean = sanitizeTerminalText(largeUnterminated);
    const duration = performance.now() - start;

    expect(clean).toBe('');
    expect(duration).toBeLessThan(50); // Doit s'exécuter en quelques millisecondes
  });

  it('consomme les autres ouvertures de chaînes de contrôle non terminées', () => {
    for (const opener of ['\x1bP', '\x1bX', '\x1b^', '\x1b_', '\x90', '\x98', '\x9d', '\x9e', '\x9f']) {
      expect(sanitizeTerminalText(opener + 'A'.repeat(10000))).toBe('');
    }
  });

  it('consomme les chaînes de contrôle SOS terminées', () => {
    // 7-bit SOS avec ST 7-bit et BEL
    expect(sanitizeTerminalText('avant\x1bXpayload_sos\x1b\\apres')).toBe('avantapres');
    expect(sanitizeTerminalText('avant\x1bXpayload_sos\x07apres')).toBe('avantapres');
    // 8-bit SOS avec ST 8-bit (\x9c)
    expect(sanitizeTerminalText('avant\x98payload_sos\x9capres')).toBe('avantapres');
  });

  it('préserve les sauts de ligne et les tabulations', () => {
    expect(sanitizeTerminalText('a\nb\tc\rd')).toBe('a\nb\tcd');
  });
});
