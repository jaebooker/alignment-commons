#!/usr/bin/env python3
"""Check an agent-written Synthcore adapter: static AST rules, then the Stage 1 toy gate.

  python3 scripts/check_adapter.py --slug my-idea --idea idea.json --method method.py \
      --synthcore /path/to/clean/alignment-synthcore [--python /path/to/sc-venv/bin/python]

Prints a JSON report. Submit it unchanged as `self_report` with submit_adapter, or as
`report` with verify_adapter.
The gate executes the method. By default it runs in Synthcore's container jail
(--jail docker): no network, no repo, read-only root, only its sandbox mounted. That
needs Docker or Podman and a Synthcore commit with harness/jail.py. --jail process is
the old separate process; use it only on code you wrote.
The check passes when the code is clean and the gate ran. A gate that ran and
failed is a legitimate result (mechanism_failed); a gate that crashed is not.
"""
import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

CHECKER_VERSION = 1
ALLOWED_IMPORTS = {
    'numpy', 'scipy', 'sklearn', 'torch', 'math', 'random', 'itertools', 'functools',
    'collections', 'heapq', 'statistics', 'dataclasses', 'typing', 'copy', 'operator',
    'bisect', 'public', '__future__',
}
FORBIDDEN_NAMES = {
    'open', 'exec', 'eval', 'compile', '__import__', 'globals', 'locals', 'vars', 'getattr',
    'setattr', 'delattr', 'breakpoint', 'input', 'memoryview', '__builtins__',
}
FILE_METHODS = {'load', 'save', 'fromfile', 'tofile', 'loadtxt', 'savetxt', 'genfromtxt',
                'memmap', 'read_csv', 'from_pretrained'}


def static_check(src):
    problems = []
    if len(src) > 30000 or src.count('\n') > 800:
        problems.append('method.py exceeds 30 KB or 800 lines.')
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return {'passed': False, 'problems': [f'Syntax error: {e}']}
    hp = [n for n in tree.body if isinstance(n, ast.Assign) and any(getattr(t, 'id', None) == 'HPARAMS' for t in n.targets)]
    if not hp:
        problems.append('Define HPARAMS as a top-level literal list.')
    else:
        try:
            grid = ast.literal_eval(hp[0].value)
            if not (isinstance(grid, list) and 1 <= len(grid) <= 8 and all(isinstance(g, dict) for g in grid)):
                problems.append('HPARAMS must be a list of 1 to 8 dicts.')
        except ValueError:
            problems.append('HPARAMS must be a literal (no names or expressions).')
    run = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'run']
    if not run or [a.arg for a in run[0].args.args[:3]] != ['tasks', 'hparams', 'seed'] \
            or len(run[0].args.args) - 3 > len(run[0].args.defaults):
        problems.append('Define run(tasks, hparams, seed) at top level; extra arguments need defaults.')
    for node in ast.walk(tree):
        line = getattr(node, 'lineno', '?')
        if isinstance(node, ast.Import):
            for a in node.names:
                if a.name.split('.')[0] not in ALLOWED_IMPORTS:
                    problems.append(f'Import of {a.name.split(".")[0]} is not allowed.')
        elif isinstance(node, ast.ImportFrom):
            if node.level or (node.module or '').split('.')[0] not in ALLOWED_IMPORTS:
                problems.append(f'Import of {node.module or "relative module"} is not allowed.')
        elif isinstance(node, ast.Name) and node.id in FORBIDDEN_NAMES:
            problems.append(f'Line {line} uses {node.id}, which reaches outside the method.')
        elif isinstance(node, ast.Attribute):
            if node.attr.startswith('__') and node.attr.endswith('__') and node.attr != '__init__':
                problems.append(f'Line {line} touches a dunder attribute.')
            if node.attr in FILE_METHODS:
                problems.append(f'Line {line} reads or writes files ({node.attr}).')
        elif isinstance(node, ast.Name) and node.id.startswith('__') and node.id.endswith('__') and node.id != '__name__':
            problems.append(f'Line {line} touches a dunder name.')
    return {'passed': not problems, 'problems': sorted(set(problems))}


DRIVER = r'''
import json, os, sys
from pathlib import Path
sys.path.insert(0, ".")
from harness import runner
slug = sys.argv[1]
spec = json.loads(Path(f"ideas/{slug}/idea.json").read_text())
try:
    try:
        from harness import jail as _jail
        jail_info = _jail.describe()
    except ImportError:
        if os.environ.get("SYNTHCORE_JAIL", "process") != "process":
            raise RuntimeError("this Synthcore commit has no container jail; update Synthcore, or use --jail process only for code you wrote")
        jail_info = {"mode": "process", "image": None}
    tb = runner.get_testbed(spec["testbed"])
    pred = spec["prediction"]
    mech = pred.get("mechanism")
    if mech and mech["diagnostic"] not in tb.diagnostics:
        raise ValueError(f"unknown diagnostic {mech['diagnostic']!r} for {tb.name}; choose from {sorted(tb.diagnostics)}")
    mp = Path(f"ideas/{slug}/method.py")
    hm, hb = runner.load_hparams(mp)[0], runner.load_hparams(tb.baseline_method)[0]
    m = [runner.run_arm(tb, mp, "dev", "toy", s, hm) for s in range(3)]
    b = [runner.run_arm(tb, tb.baseline_method, "dev", "toy", s, hb) for s in range(3)]
    g = runner._gate(tb, pred, m, b)
    out = {"ran": True, **g, "testbed": tb.name, "evaluator_hash": tb.evaluator_hash(), "seeds": 3, "jail": jail_info}
except Exception as e:
    out = {"ran": False, "error": f"{type(e).__name__}: {e}"[:2000]}
print("GATE_JSON" + json.dumps(out))
'''


def run_gate(synthcore, slug, idea, method_src, python, timeout, jail='docker'):
    root = Path(synthcore).resolve()
    commit = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
    with tempfile.TemporaryDirectory(prefix='adapter-check-') as temp:
        archive = Path(temp) / 'src.tar'
        subprocess.run(['git', '-C', str(root), 'archive', '--format=tar', '-o', str(archive), commit], check=True)
        work = Path(temp) / 'src'; work.mkdir()
        with tarfile.open(archive) as tf:
            tf.extractall(work, filter='data')
        d = work / 'ideas' / slug
        if d.exists():
            return commit, {'ran': False, 'error': f'ideas/{slug} already exists at this commit.'}
        d.mkdir(parents=True)
        (d / 'idea.json').write_text(json.dumps(idea, indent=2) + '\n')
        (d / 'method.py').write_text(method_src)
        cache = root / 'results' / '_cache'  # reuse generated testbeds; they are not ground truth for this method's arm
        if cache.exists():
            (work / 'results').mkdir(exist_ok=True)
            (work / 'results' / '_cache').symlink_to(cache, target_is_directory=True)
        env = {k: v for k, v in os.environ.items() if 'TOKEN' not in k and 'KEY' not in k and not k.startswith('DATABASE')}
        env['SYNTHCORE_JAIL'] = jail
        try:
            p = subprocess.run([python, '-c', DRIVER, slug], cwd=work, env=env, capture_output=True, text=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            return commit, {'ran': False, 'error': f'Gate exceeded {timeout}s.'}
        line = next((l for l in p.stdout.splitlines() if l.startswith('GATE_JSON')), None)
        if not line:
            return commit, {'ran': False, 'error': (p.stderr or p.stdout)[-2000:] or f'exit {p.returncode}'}
        return commit, json.loads(line[len('GATE_JSON'):])


def check(slug, idea, method_src, synthcore=None, python=sys.executable, timeout=1800, jail='docker'):
    report = {'checker_version': CHECKER_VERSION, 'slug': slug,
              'method_sha256': hashlib.sha256(method_src.encode()).hexdigest(),
              'static': static_check(method_src)}
    if synthcore and report['static']['passed'] and idea.get('testbed'):
        report['synthcore_commit'], report['gate'] = run_gate(synthcore, slug, idea, method_src, python, timeout, jail)
    else:
        report['gate'] = {'ran': False, 'error': 'Skipped: static check failed, no testbed, or no --synthcore.'}
    report['passed'] = report['static']['passed'] and report['gate'].get('ran') is True
    return report


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--slug', required=True)
    ap.add_argument('--idea', required=True, type=Path)
    ap.add_argument('--method', required=True, type=Path)
    ap.add_argument('--synthcore', help='clean Synthcore checkout; omit for static checks only')
    ap.add_argument('--python', default=sys.executable)
    ap.add_argument('--timeout', type=int, default=1800)
    ap.add_argument('--jail', choices=('docker', 'podman', 'process'), default='docker',
                    help='where the gate runs the method (default docker)')
    a = ap.parse_args()
    r = check(a.slug, json.loads(a.idea.read_text()), a.method.read_text(), a.synthcore, a.python, a.timeout, a.jail)
    print(json.dumps(r, indent=2))
    sys.exit(0 if r['passed'] else 1)


if __name__ == '__main__':
    main()
