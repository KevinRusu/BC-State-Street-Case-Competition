"""Checks that the living docs still point at real files and that docs/FINDINGS.md matches the current results.

Step by step:
1. In CLAUDE.md, README.md and the docs directly under docs/, collect every repo path written in backticks
   (anything with a slash) and every relative Markdown link.
2. Each must exist (globs like `config/*.toml` must match something). Exceptions: folders that are local or
   generated (they may be absent in a fresh clone) and PLANNED files we have said we will create.
3. Compare the register checksum in docs/FINDINGS.md, and in every fact card of docs/DEFECT_CATALOG.md, with
   outputs/02_defect_register.csv
   (skipped when outputs/ has not been built on this machine).
Exit code 1 if anything is wrong, so it can sit in a checklist or a test.

docs/DECISIONS.md is skipped on purpose: it is an append-only history and names files that no longer exist.
Frozen check-in folders (docs/checkins/) are skipped too.

Run from the repo root: uv run python scripts/check_docs.py
"""
import hashlib, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCAL = ('outputs/', 'tests/runs/', 'reference/official/', 'AI_Logs/', 'data/')
# Files we have said we will create. Remove a line once the file exists.
PLANNED = {
    'docs/checkins/checkin2/Checkin2.pptx',
    'docs/final/',
    'src/',
    'run_all.py',
}
SKIP = {'DECISIONS.md'}

TICKED = re.compile(r'`([^`\s]+/[^`\s]*)`')
LINKED = re.compile(r'\]\(([^)\s#]+)(?:#[^)]*)?\)')


def living_docs():
    yield ROOT / 'CLAUDE.md'
    yield ROOT / 'README.md'
    yield from sorted(p for p in (ROOT / 'docs').glob('*.md') if p.name not in SKIP)


def is_repo_path(ref):
    """A backticked token is a repo path if it starts at a real (or planned) top-level entry, e.g. not `DD/MM/YYYY`.
    Template names such as `docs/checkins/checkinN/` are skipped."""
    tops = {p.name for p in ROOT.iterdir()} | {p.split('/')[0] for p in PLANNED}
    if ref.split('/')[0] not in tops:
        return False
    return not any(re.fullmatch(r'[a-z_]+N', seg) or '<' in seg for seg in ref.split('/'))


def exists(path, base):
    target = (base / path)
    if any(ch in path for ch in '*?['):
        return any(base.glob(path))
    return target.exists()


def check_paths():
    problems = []
    for doc in living_docs():
        if not doc.exists():
            problems.append(f'{doc.relative_to(ROOT)}: file missing')
            continue
        text = doc.read_text()
        refs = [(m, ROOT) for m in TICKED.findall(text) if is_repo_path(m)]
        refs += [(m, doc.parent) for m in LINKED.findall(text) if not m.startswith(('http', 'mailto:'))]
        for ref, base in refs:
            rel = ref.rstrip(':,.')
            if base == ROOT and (rel.startswith(LOCAL) or rel in PLANNED):
                continue
            if base != ROOT and str((base / rel).resolve().relative_to(ROOT)) in PLANNED:
                continue
            if not exists(rel, base):
                problems.append(f'{doc.relative_to(ROOT)}: `{ref}` does not exist')
    return problems


def check_findings():
    register = ROOT / 'outputs' / '02_defect_register.csv'
    findings = ROOT / 'docs' / 'FINDINGS.md'
    if not register.exists():
        print('note: outputs/02_defect_register.csv not built here; FINDINGS freshness not checked')
        return []
    if not findings.exists():
        return ['docs/FINDINGS.md missing: run scripts/build_findings.py']
    current = hashlib.sha256(register.read_bytes()).hexdigest()[:12]
    problems = []
    m = re.search(r'Register checksum: `([0-9a-f]+)`', findings.read_text())
    if not m or m.group(1) != current:
        problems.append('docs/FINDINGS.md is older than outputs/02_defect_register.csv: run scripts/build_findings.py')
    catalog = ROOT / 'docs' / 'DEFECT_CATALOG.md'
    if catalog.exists():
        stale = set(re.findall(r'register \(checksum `([0-9a-f]+)`\)', catalog.read_text())) - {current}
        if stale:
            problems.append('docs/DEFECT_CATALOG.md cards are older than the register: run scripts/build_findings.py')
    return problems


def main():
    problems = check_paths() + check_findings()
    for p in problems:
        print('FAIL', p)
    if problems:
        sys.exit(1)
    print('docs check passed')


if __name__ == '__main__':
    main()
