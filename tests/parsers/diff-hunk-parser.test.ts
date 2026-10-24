import { describe, expect, it } from 'bun:test';
import { extractCodeContext } from '../../src/parsers/diff-hunk-parser';

describe('Diff Hunk Parser - Extraction du contexte de code et découpage focalisé', () => {
  const greptilePR112Hunk = `@@ -60,14 +60,42 @@ def check_display_env() -> None:
         os.environ["DISPLAY"] = ":0"
 
 
+# Répertoires système de confiance pour la résolution des binaires externes
+# (mitige le détournement de PATH : shutil.which n'est jamais appelé avec le PATH ambiant)
+_TRUSTED_BIN_DIRS = ["/usr/local/bin", "/usr/bin", "/bin", "/usr/local/sbin", "/usr/sbin", "/sbin"]
+if os.name == "nt":
+    _win_root = os.environ.get("SystemRoot", r"C:\\Windows")
+    _TRUSTED_BIN_DIRS = [os.path.join(_win_root, "System32"), _win_root]
+
+# Métacaractères de shell interdits dans les arguments transmis aux sous-processus
+_SHELL_UNSAFE_CHARS = frozenset(";|&$\`<>\\n\\r")
+
+
+def _find_trusted_bin(name: str, fallback: str | None = None) -> str | None:
+    """Résout un binaire externe uniquement dans des répertoires système de confiance (chemin absolu)."""
+    resolved = shutil.which(name, path=os.pathsep.join(_TRUSTED_BIN_DIRS))`;

  it('extrait exactement les 4 lignes de code ciblées pour le commentaire Greptile de la PR 112', () => {
    const { focusedDiffHunk, codeContext } = extractCodeContext(greptilePR112Hunk, 76, undefined, 'RIGHT');

    // Le diff focalisé ne doit pas contenir les lignes 60 à 72
    expect(focusedDiffHunk).not.toContain('check_display_env');
    expect(focusedDiffHunk).not.toContain('_TRUSTED_BIN_DIRS =');
    expect(focusedDiffHunk).not.toContain('SystemRoot');
    expect(focusedDiffHunk).not.toContain('_SHELL_UNSAFE_CHARS');

    // Il doit contenir la fonction _find_trusted_bin et son corps
    expect(focusedDiffHunk).toContain('def _find_trusted_bin(name: str, fallback: str | None = None) -> str | None:');
    expect(focusedDiffHunk).toContain('resolved = shutil.which(name, path=os.pathsep.join(_TRUSTED_BIN_DIRS))');

    // L'en-tête doit refléter le découpage (avec oldStart ajusté à la ligne précédente car oldLen=0)
    expect(focusedDiffHunk).toMatch(/^@@ -62,0 \+73,4 @@/);

    // Le codeContext doit être propre et comporter les numéros 73 à 76
    const lines = codeContext.split('\n');
    expect(lines.length).toBe(4);
    expect(lines[0]).toBe('73 +');
    expect(lines[1]).toBe('74 + def _find_trusted_bin(name: str, fallback: str | None = None) -> str | None:');
    expect(lines[2]).toBe('75 +     """Résout un binaire externe uniquement dans des répertoires système de confiance (chemin absolu)."""');
    expect(lines[3]).toBe('76 +     resolved = shutil.which(name, path=os.pathsep.join(_TRUSTED_BIN_DIRS))');
  });

  it('gère les commentaires multilignes avec plage explicite (startLine et line)', () => {
    // Commentaire CodeRabbit ciblant les lignes 67 à 68
    const { focusedDiffHunk, codeContext } = extractCodeContext(greptilePR112Hunk, 68, 67, 'RIGHT');

    expect(focusedDiffHunk).toContain('_win_root = os.environ.get("SystemRoot"');
    expect(focusedDiffHunk).toContain('_TRUSTED_BIN_DIRS = [os.path.join');
    // Doit inclure le contexte précédent pour atteindre au moins 4 lignes
    expect(codeContext).toContain('67 +');
    expect(codeContext).toContain('68 +');
  });

  it('gère les modifications de type suppression (lignes - avec side LEFT)', () => {
    const deletionHunk = `@@ -10,5 +10,2 @@
 function test() {
-  const deprecatedA = 1;
-  const deprecatedB = 2;
-  const deprecatedC = 3;
   return 0;
 }`;

    const { focusedDiffHunk, codeContext } = extractCodeContext(deletionHunk, 12, undefined, 'LEFT');
    expect(focusedDiffHunk).toContain('-  const deprecatedB = 2;');
    expect(codeContext).toContain('12 -   const deprecatedB = 2;');
  });

  it('gère les cas limites d’entrées vides ou invalides', () => {
    expect(extractCodeContext('')).toEqual({ focusedDiffHunk: '', codeContext: '' });
    expect(extractCodeContext('   \n  ')).toEqual({ focusedDiffHunk: '', codeContext: '' });
    expect(extractCodeContext(undefined)).toEqual({ focusedDiffHunk: '', codeContext: '' });

    const malformed = 'Ligne sans en-tête diff';
    expect(extractCodeContext(malformed)).toEqual({ focusedDiffHunk: malformed, codeContext: malformed });
  });

  it('gère les diffs courts (inférieurs à 4 lignes)', () => {
    const shortHunk = `@@ -1,2 +1,2 @@
-old
+new`;
    const { focusedDiffHunk, codeContext } = extractCodeContext(shortHunk, 1, undefined, 'RIGHT');
    expect(focusedDiffHunk).toContain('+new');
    expect(codeContext).toContain('1 + new');
  });

  it('attribue des numéros de lignes distincts et corrects aux ajouts et suppressions mélangés', () => {
    const mixedHunk = `@@ -765,3 +793,3 @@
         env["DISPLAY"] = env.get("DISPLAY", ":0")
-        xdotool_bin = shutil.which("xdotool") or "/bin/xdotool"
+        xdotool_bin = _find_trusted_bin("xdotool", "/bin/xdotool")
         res = subprocess.run([xdotool_bin, *args], env=env, capture_output=True, check=False, timeout=5)`;

    const { focusedDiffHunk, codeContext } = extractCodeContext(mixedHunk, 795, undefined, 'RIGHT');
    expect(focusedDiffHunk).toContain('-        xdotool_bin = shutil.which');
    expect(focusedDiffHunk).toContain('+        xdotool_bin = _find_trusted_bin');

    const lines = codeContext.split('\n');
    // Vérifie que la ligne supprimée porte bien le numéro de l'ancien fichier (766)
    // et que la ligne ajoutée porte bien le numéro du nouveau fichier (794)
    expect(lines[0]).toBe('793           env["DISPLAY"] = env.get("DISPLAY", ":0")');
    expect(lines[1]).toBe('766 -         xdotool_bin = shutil.which("xdotool") or "/bin/xdotool"');
    expect(lines[2]).toBe('794 +         xdotool_bin = _find_trusted_bin("xdotool", "/bin/xdotool")');
    expect(lines[3]).toBe('795           res = subprocess.run([xdotool_bin, *args], env=env, capture_output=True, check=False, timeout=5)');
  });

  it('gère les fins de ligne CRLF (Windows) et les sauts de ligne initiaux', () => {
    const crlfHunk = "\r\n@@ -10,3 +10,3 @@\r\n line 10\r\n-line 11 old\r\n+line 11 new\r\n";
    const { focusedDiffHunk, codeContext } = extractCodeContext(crlfHunk, 11, undefined, 'RIGHT');
    expect(focusedDiffHunk).not.toContain('\r');
    expect(focusedDiffHunk).toContain('+line 11 new');
    expect(codeContext).toContain('11 + line 11 new');
    expect(codeContext).toContain('11 - line 11 old');
  });

  it('gère correctement les marqueurs No newline at end of file sans leur attribuer de faux numéro', () => {
    const noNewlineHunk = `@@ -1,2 +1,2 @@
-old line
\\ No newline at end of file
+new line
\\ No newline at end of file`;

    const { focusedDiffHunk, codeContext } = extractCodeContext(noNewlineHunk, 1, undefined, 'RIGHT');
    expect(focusedDiffHunk).toContain('\\ No newline at end of file');
    // codeContext ne doit pas contenir de numéro de ligne avant '\ No newline at end of file'
    expect(codeContext).toContain('\\ No newline at end of file');
    expect(codeContext).not.toMatch(/\d+\s+\\ No newline/);
  });
});
