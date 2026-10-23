#!/usr/bin/env python3
"""Pin the worker catalogue to a clean reviewed Synthcore checkout. Does not publish."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('synthcore', type=Path)
args = ap.parse_args()
root = args.synthcore.resolve()
if subprocess.check_output(['git','-C',str(root),'status','--porcelain'],text=True).strip():
    ap.error('Use a clean reviewed Synthcore checkout.')
commit = subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()
project = Path(__file__).resolve().parent.parent
published = json.loads((project/'site/tests.json').read_text())
ideas=[]
for p in sorted((root/'ideas').glob('*/idea.json')):
    idea=json.loads(p.read_text()); idea['id']=p.parent.name
    method=p.parent/'method.py'
    idea['method_sha256']=hashlib.sha256(method.read_bytes()).hexdigest() if method.exists() else None
    idea['reference_url']=idea['source'].get('url') or f"{published['repo']}/blob/{commit}/ideas/{p.parent.name}/idea.json"
    idea['reference_label']='Source paper' if idea['source'].get('url') else 'Paper reference / method specification'
    ideas.append(idea)
(project/'lib/catalog.json').write_text(json.dumps({'commit':commit,'repo':published['repo'],'ideas':ideas,'testbeds':published['testbeds']},indent=2)+'\n')
print(f'Pinned {len(ideas)} ideas at {commit}. Review, test, and deploy this catalogue change.')
