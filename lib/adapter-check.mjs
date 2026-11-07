// Code node: static checks on an agent-written method.py before anyone else runs it.
// A text-level mirror of scripts/check_adapter.py, which parses the AST and is authoritative.
// Neither is a sandbox. They stop accidental and casual reads of ground truth and the host;
// a human still reads the code before it is admitted and executed by other agents.
export const ALLOWED_IMPORTS = [
  "numpy", "scipy", "sklearn", "torch", "math", "random", "itertools", "functools",
  "collections", "heapq", "statistics", "dataclasses", "typing", "copy", "operator",
  "bisect", "public", "__future__",
];
const FORBIDDEN = [
  [/(?<![\w.])(open|exec|eval|compile|__import__|globals|locals|vars|getattr|setattr|delattr|breakpoint|input|memoryview)\s*\(/, "calls a builtin that reaches outside the method"],
  [/__(?!init__\b|future__\b)\w+__/, "touches a dunder attribute"],
  [/\.(load|save|fromfile|tofile|loadtxt|savetxt|genfromtxt|memmap|read_csv|from_pretrained)\s*\(/, "reads or writes files"],
];
// Blank out string literals and comments, keeping line breaks so line numbers hold.
function codeOnly(src) {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === '"' || c === "'") {
      const q = src.startsWith(c.repeat(3), i) ? c.repeat(3) : c;
      i += q.length;
      while (i < src.length && !src.startsWith(q, i)) {
        if (src[i] === "\\") i++;
        else if (src[i] === "\n") { if (q.length === 1) break; out += "\n"; }
        i++;
      }
      i += q.length; out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
}
export function checkAdapter(src) {
  const problems = [];
  if (typeof src !== "string" || !src.trim()) return { passed: false, problems: ["method.py is empty."] };
  if (src.length > 30000 || src.split("\n").length > 800) problems.push("method.py exceeds 30 KB or 800 lines.");
  if (!/^HPARAMS\s*=\s*\[/m.test(src)) problems.push("Define HPARAMS as a top-level literal list.");
  if (!/^def run\(\s*tasks\s*,\s*hparams\s*,\s*seed\s*(,\s*\w+\s*=[^,)]+)*\s*\)\s*(->[^:]+)?:/m.test(src))
    problems.push("Define run(tasks, hparams, seed) at top level.");
  for (const m of src.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+?)(?:\s+as\s+\w+)?\s*$)/gm)) {
    const mods = (m[1] ?? m[2]).split(",").map((x) => x.trim().split(/\s+/)[0].split(".")[0]);
    for (const mod of mods)
      if (mod && !ALLOWED_IMPORTS.includes(mod)) problems.push(`Import of ${mod} is not allowed.`);
  }
  codeOnly(src).split("\n").forEach((code, n) => {
    for (const [re, why] of FORBIDDEN) if (re.test(code)) problems.push(`Line ${n + 1} ${why}.`);
  });
  return { passed: problems.length === 0, problems: [...new Set(problems)] };
}
