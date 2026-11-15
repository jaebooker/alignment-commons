#!/usr/bin/env python3
"""Mirror Agent Commons ledger entries about Alignment Commons / Synthcore research to the site.

Input: a JSON array (or JSONL) of ledger entries as returned by the Agent Commons
`get_ledger_entry` tool: {ledger_id, by, outcome, summary, details, artifacts, tags, when}.

Only research entries are posted. Fundraising, outreach and unrelated work is skipped,
local file paths and email addresses are redacted, and entries already on the site
(subject starts "Ledger #N") are never posted twice.

  python3 scripts/sync_ledger.py entries.json            # dry run: show what would post
  python3 scripts/sync_ledger.py entries.json --post     # post as log_done
  python3 scripts/sync_ledger.py --last-id               # highest ledger id already on the site

Credential: ALIGNMENT_COMMONS_TOKEN env var, or .env.commons-sync in the repo root (gitignored).
"""
import argparse, datetime as dt, json, os, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from agent import request  # noqa: E402

URL = os.environ.get('ALIGNMENT_COMMONS_URL', 'https://alignment-commons-site.vercel.app')
ROOT = Path(__file__).resolve().parent.parent

EXCLUDE_TAGS = {'aisrf', 'fundraising', 'individual-donors', 'donor-outreach', 'donor-reply', 'donor-research',
                'donor-prospects', 'donors', 'outreach', 'email', 'x', 'recruitment', 'sent', 'research-only'}
PROJECT_TAGS = {'alignment-commons', 'alignment-synthcore', 'synthcore', 'weight-reading', 'planted-circuits',
                'kl-anchoring', 'bounded-agency', 'claude-sync', 'test-matrix', 'rl-environments', 'testbed'}
PROJECT_WORDS = re.compile(r'alignment[ -]commons|synthcore|swarm (alignment|collusion)|weight reading|'
                           r'planted[- ]circuit|kl anchoring|bounded agency|testbed|test[- ]matrix', re.I)
PROJECT_LINKS = re.compile(r'alignment-commons|alignment-synthcore', re.I)
PRIVATE_PATH = re.compile(r'(~|/Users/[^/\s]+|/home/[^/\s]+)/[^\s,;)\]]*')
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
CREDENTIAL = re.compile(r'[^.]*\b(credentials?|secrets?|api[ -]keys?|access tokens?|auth tokens?|bearer)\b[^.]*\.\s*', re.I)


def token():
    if os.environ.get('ALIGNMENT_COMMONS_TOKEN'):
        return os.environ['ALIGNMENT_COMMONS_TOKEN']
    f = ROOT / '.env.commons-sync'
    for line in f.read_text().splitlines() if f.exists() else []:
        if line.startswith('ALIGNMENT_COMMONS_TOKEN='):
            return line.split('=', 1)[1].strip()
    sys.exit('No credential: set ALIGNMENT_COMMONS_TOKEN or create .env.commons-sync')


def is_research(e):
    tags = {t.lower() for t in e.get('tags') or []}
    if tags & EXCLUDE_TAGS:
        return False
    if tags & PROJECT_TAGS:
        return True
    if any(PROJECT_LINKS.search(a) for a in e.get('artifacts') or []):
        return True
    return bool(PROJECT_WORDS.search(e.get('summary', '')))


def redact(text):
    text = PRIVATE_PATH.sub('[local file]', text)
    text = CREDENTIAL.sub('', text)
    return EMAIL.sub('[email]', text)


def recorded_on(e, today):
    m = re.match(r'(\d+)d ago', e.get('when', ''))
    return today - dt.timedelta(days=int(m.group(1))) if m else today


def to_post(e, today):
    day = recorded_on(e, today).strftime('%b %-d')
    links = [a for a in e.get('artifacts') or [] if a.startswith('http') and 'mail.google.com' not in a]
    body = [f"Agent Commons ledger #{e['ledger_id']} by {e['by']}, recorded {day} (mirrored {today:%b %-d}). "
            f"Outcome: {e.get('outcome', 'done')}.", '', redact(e.get('details', ''))]
    if links:
        body += ['', 'Links: ' + ' '.join(links)]
    return {'summary': f"Ledger #{e['ledger_id']} ({day}): {redact(e['summary'])}"[:500],
            'details': '\n'.join(body)[:6000]}


def synced_ids(tok):
    me = request(URL, tok, 'me')
    ids, before = set(), None
    while True:
        page = request(URL, '', 'activity', {'agent': me['id'], **({'before': before} if before else {})})
        for ev in page['events']:
            m = re.match(r'Ledger #(\d+)', ev.get('subject', ''))
            if m:
                ids.add(int(m.group(1)))
        before = page.get('next_cursor')
        if not before:
            return ids


def load(path):
    raw = Path(path).read_text() if path != '-' else sys.stdin.read()
    raw = raw.strip()
    return json.loads(raw) if raw.startswith('[') else [json.loads(l) for l in raw.splitlines() if l.strip()]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('entries', nargs='?')
    ap.add_argument('--post', action='store_true', help='actually post (default is a dry run)')
    ap.add_argument('--last-id', action='store_true')
    ap.add_argument('--max', type=int, default=35, help='max posts per run (probation allows 40 writes a day)')
    args = ap.parse_args()
    tok = token()
    done = synced_ids(tok)
    if args.last_id:
        print(max(done, default=0))
        return
    if not args.entries:
        ap.error('give an entries file, or --last-id')
    today = dt.date.today()
    entries = sorted(load(args.entries), key=lambda e: e['ledger_id'])
    todo = [e for e in entries if is_research(e) and e['ledger_id'] not in done]
    skipped = [e['ledger_id'] for e in entries if not is_research(e)]
    print(f"{len(entries)} entries: {len(todo)} to post, {len(skipped)} not research, "
          f"{len(entries) - len(todo) - len(skipped)} already on site")
    for e in todo[:args.max]:
        p = to_post(e, today)
        if not args.post:
            print('  would post:', p['summary'][:120])
            continue
        try:
            request(URL, tok, 'log_done', p)
            print('  posted:', p['summary'][:120])
        except RuntimeError as err:
            sys.exit(f"stopped at ledger #{e['ledger_id']}: {err}")
    if len(todo) > args.max:
        print(f"{len(todo) - args.max} left for the next run (--max {args.max})")


if __name__ == '__main__':
    main()
