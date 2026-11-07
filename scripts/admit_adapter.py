#!/usr/bin/env python3
"""Reviewer gate for the paper -> adapter pipeline. The one human step.

  python3 scripts/admit_adapter.py PROPOSAL_ID --synthcore /path/to/alignment-synthcore
      Writes the proposal's method.py to review/<slug>.method.py and stops. Read it.
  python3 scripts/admit_adapter.py PROPOSAL_ID --synthcore ... --reviewed [--python ...]
      Reruns static checks and the Stage 1 gate on your checkout, compares them with the
      author's self-report, then commits ideas/<slug>/ on branch adapter/<slug>.

Nothing is admitted on the server until you record it with review_proposal after merging.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from agent import request  # noqa: E402
import check_adapter  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('proposal')
    ap.add_argument('--synthcore', required=True)
    ap.add_argument('--url', default=os.environ.get('ALIGNMENT_COMMONS_URL', 'https://alignment-commons-site.vercel.app'))
    ap.add_argument('--python', default=sys.executable)
    ap.add_argument('--reviewed', action='store_true', help='I have read method.py and idea.json')
    ap.add_argument('--tolerance', type=float, default=1e-3)
    a = ap.parse_args()
    pr = request(a.url, '', 'proposal', {'id': a.proposal})
    if pr['status'] != 'adapted':
        sys.exit(f"Proposal is {pr['status']}; only an adapted proposal can be admitted.")
    slug, idea, src = pr['slug'], pr['idea'], pr['method_py']
    review = Path('review'); review.mkdir(exist_ok=True)
    (review / f'{slug}.method.py').write_text(src)
    (review / f'{slug}.idea.json').write_text(json.dumps(idea, indent=2) + '\n')
    if not a.reviewed:
        print(f"Read review/{slug}.method.py and review/{slug}.idea.json.")
        print(f"Paper: {pr['paper_title']} <{pr['paper_url']}>; claim quote verified: {pr['quote_verified']}")
        if pr.get('returns'):
            print(f"{len(pr['returns'])} earlier return(s); latest: {pr['returns'][-1]['reason']}")
        print('Rerun with --reviewed once you have read them. The gate executes this code.')
        return
    root = Path(a.synthcore).resolve()
    if subprocess.check_output(['git', '-C', str(root), 'status', '--porcelain'], text=True).strip():
        sys.exit('Use a clean Synthcore checkout.')
    mine = check_adapter.check(slug, idea, src, str(root), a.python)
    theirs = pr['self_report']
    print(json.dumps({'reviewer_check': mine, 'author_self_report': theirs}, indent=2))
    problems = []
    if not mine['passed']:
        problems.append('Your rerun of the checks failed.')
    else:
        g, t = mine['gate'], theirs['gate']
        if g['passed'] != t['passed']:
            problems.append(f"Gate outcome differs: yours {g['passed']}, author's {t['passed']}.")
        if abs(g['observed'] - t['observed']) > a.tolerance * max(1.0, abs(t['observed'])):
            problems.append(f"Gate observed differs: yours {g['observed']}, author's {t['observed']}.")
        if g['evaluator_hash'] != t['evaluator_hash']:
            problems.append('Evaluator hash differs; the author ran a different testbed version.')
    if problems:
        print('\nNot committed. Return the proposal with this evidence:\n  ' + '\n  '.join(problems))
        sys.exit(1)
    d = root / 'ideas' / slug
    subprocess.run(['git', '-C', str(root), 'checkout', '-b', f'adapter/{slug}'], check=True)
    d.mkdir(parents=True)
    (d / 'idea.json').write_text(json.dumps(idea, indent=2) + '\n')
    (d / 'method.py').write_text(src)
    subprocess.run(['git', '-C', str(root), 'add', f'ideas/{slug}'], check=True)
    subprocess.run(['git', '-C', str(root), 'commit', '-m',
                    f"Add {slug} adapter\n\nAlignment Commons proposal {pr['id']}\nPaper: {pr['paper_url']}"], check=True)
    commit = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
    print(f"\nCommitted {commit} on adapter/{slug}. Next:")
    print('  1. Push and merge it into the pinned Synthcore branch.')
    print('  2. python3 scripts/sync-catalog.py /path/to/merged/synthcore && node scripts/build-candidates.mjs; deploy.')
    print('  3. Record admission with the merged commit:')
    print(f"     python3 scripts/agent.py call review_proposal '{json.dumps({'id': pr['id'], 'decision': 'admit', 'commit': 'MERGED_COMMIT', 'note': 'Read code; rerun matched self-report.'})}'")


if __name__ == '__main__':
    main()
