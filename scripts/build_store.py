"""Builds outputs/store.duckdb, the one file the dashboard (dashboard/) reads. The dashboard never computes a defect.

Step by step:
1. Load every table in the manifest as text (DuckDB all_varchar=true) with its source row number; check the row and
   column counts against the manifest. Add a normalised `<column>_norm` (YYYY-MM-DD) next to every date column;
   unreadable dates become NULL there and the raw text stays as it is.
2. Write the graph the dashboard draws (GRAPH below: office rows, stage columns, tables with the check that owns
   them and where their data comes from, joins, the control map's handoffs and the rules from docs/RULES.md that
   watch each one). Every rule ID, check and owner is checked against docs/RULES.md and scripts/framework.json.
3. Join health for every join: rows, blank keys, distinct keys, keys found on one side only, rows per key. This
   describes the RAW keys before notebook 02's cleaning; it is not a detection rule (D-001).
4. Copy notebook 02's defect register (outputs/02_defect_register.csv), with the one map element each line counts
   on, and its example IDs, the rule texts from
   docs/RULES.md, the column descriptions from data_dictionary.csv, and the demo traces (the record of
   outputs/02_trace.csv, then the first example of each register line).
5. Write to a temporary file, then swap it in, so a running dashboard never sees a half-built store.

Paths follow notebook 02: RECONCILIATION_DATA (manifest), RECONCILIATION_CONFIG, RECONCILIATION_OUTPUTS (register in,
store out). STORE_PATH overrides where the store goes. A missing register is allowed (the map then has no counts).

Run from the repo root after notebook 02: uv run python scripts/build_store.py
"""
import csv, hashlib, json, os, re, sys, tomllib
from datetime import datetime
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent


def path_from_env(variable, default):
    """A path from an optional environment variable (for tests), else the default; relative paths start at the repo root."""
    path = Path(os.environ.get(variable) or default)
    return path if path.is_absolute() else ROOT / path


MANIFEST_PATH = path_from_env('RECONCILIATION_DATA', 'manifest.csv')
CONFIG_PATH = path_from_env('RECONCILIATION_CONFIG', 'config/reconciliation.toml')
OUTPUTS = path_from_env('RECONCILIATION_OUTPUTS', 'outputs')
STORE_PATH = path_from_env('STORE_PATH', OUTPUTS / 'store.duckdb')
REGISTER = OUTPUTS / '02_defect_register.csv'
TRACE = OUTPUTS / '02_trace.csv'
RULES_MD = ROOT / 'docs' / 'RULES.md'
FRAMEWORK = ROOT / 'scripts' / 'framework.json'
DICTIONARY = ROOT / 'data_dictionary.csv'

DATE_COLUMNS = {
    'transactions': ['trade_date', 'settlement_date'],
    'positions': ['as_of_date'],
    'comparison_positions': ['as_of_date'],
    'accounts': ['open_date', 'close_date'],
    'securities': ['maturity_date'],
    'corporate_actions': ['ex_date', 'effective_date'],
    'prices': ['price_date'],
    'fx_rates': ['rate_date'],
    'ledger_nav': ['as_of_date'],
}
# Lookup columns the trace filters on.
INDEXES = {
    'transactions': ['transaction_id', 'account_id', 'security_id', 'related_transaction_id'],
    'pipeline_events': ['transaction_id'],
    'positions': ['position_id', 'account_id', 'security_id'],
    'comparison_positions': ['comparison_id', 'account_id', 'security_id'],
    'prices': ['security_id'],
}

# ---------------------------------------------------------------------------------------------------------------
# The graph: a grid. Rows are the offices (plus the independent sources), columns are the stages of the flow
# (D-049, drafted in dashboard/README.md). A table sits in the row of the office that handles it: the owner of its
# check in scripts/framework.json. Handoffs follow the control map; joins follow Dataset Guide §2.
# x/y are the top-left corner of each box on the dashboard canvas (pixels).
# comes_from: a chip on the box. data = the data names the source (values read from `column`); reasoning = ours.
# kind: handoff = numbered control-map handoff; flow = data moving, not numbered; lookup = reference join (toggle).
# from_handle/to_handle: the side a line leaves or enters, with -a / -b for a point 30 % / 70 % along that side.
# tag_at/tag_side: where along the line its small tag sits (0-1) and which way it extends.
# A join: left = the referencing side. required = sides whose keys must all find a partner; unique = sides whose
# keys should appear once. A left_filter limits the left rows (SQL on the left table).
GRAPH = {
    'offices': [
        dict(id='front', label='Front office', kind='office', x=10, y=70, w=980, h=136),
        dict(id='middle', label='Middle office', kind='office', x=10, y=212, w=980, h=214),
        dict(id='back', label='Back office', kind='office', x=10, y=432, w=980, h=96),
        dict(id='independent', label='Independent sources', kind='independent', x=10, y=542, w=980, h=130),
    ],
    'stages': [
        dict(id='address_books', label='Address books', note='master data, feeds the flow', x=110, w=220),
        dict(id='transactions', label='Transactions', note='', x=330, w=220),
        dict(id='positions', label='Positions', note='', x=550, w=220),
        dict(id='nav', label='NAV & ledger', note='', x=770, w=220),
    ],
    'nodes': [
        dict(id='accounts', label='Accounts', office='front', stage='address_books', check='Account check', x=130, y=112,
             grain='1 row = 1 account', rules=['ACC_REQUIRED_FIELDS'],
             note='The back office uses its fund and share class for the NAV (brief §3: front and back).',
             comes_from=[dict(label='client onboarding', evidence='reasoning',
                              reason='Our reasoning: no column says where accounts come from.')]),
        dict(id='transactions', label='Transactions', office='middle', office_label='Front + middle office',
             stage='transactions', check='Trade check', x=350, y=180, grain='1 row = 1 trade record',
             note='Created in the front office; the middle office accepts and books it.',
             rules=['TXN_DUPLICATE', 'TXN_FIELDS_VALID', 'TXN_NEGATIVE_SIDE_EVIDENCE', 'TXN_BLANK_QUANTITY_EVIDENCE'],
             comes_from=[dict(label='{n} trade system{s}', evidence='data', column='transactions.source_system')]),
        dict(id='corporate_actions', label='Corporate actions', office='middle', stage='transactions',
             check='Corporate action check', x=350, y=342, grain='1 row = 1 issuer event (not per account)',
             rules=['CA_TERMS_COMPLETE'],
             comes_from=[dict(label='company notices', evidence='reasoning',
                              reason="Our reasoning: no column records the issuer's notice of the event.")]),
        dict(id='securities', label='Securities', office='middle', stage='address_books', check='Security check',
             x=130, y=262, grain='1 row = 1 security', rules=['SEC_IDENTIFIER_VALID'],
             comes_from=[dict(label='reference data', evidence='reasoning',
                              reason='Our reasoning: no column says where the security master comes from.')]),
        dict(id='pipeline_events', label='Pipeline events', office='middle', stage='transactions', check='Trade check',
             x=350, y=270, grain='1 row = timestamps of 1 trade', rules=['TXN_TIMESTAMPS_IN_ORDER', 'TXN_AFTER_CUTOFF']),
        # POS_KEYS_MASTERED and NAV_SHARE_CLASS_MAPPING also sit on their (hidden) lookup lines; the table wins the
        # count, so their findings show on the map with lookups off.
        dict(id='positions', label='Positions (our book)', office='middle', stage='positions', check='Position check',
             x=570, y=290, grain='1 row = account x security x date', rules=['POS_REBUILD_MATCHES', 'POS_KEYS_MASTERED']),
        dict(id='ledger_nav', label='Ledger NAV', office='back', stage='nav', check='NAV check', x=790, y=458,
             grain='1 row = fund x share class x date', rules=['NAV_ARITHMETIC', 'NAV_SHARE_CLASS_MAPPING']),
        dict(id='comparison_positions', label='Custodian positions', office='independent', stage='positions',
             check='Position check', x=390, y=558, grain='1 row = account x security x date', rules=[],
             comes_from=[dict(label='custodian feed', evidence='data', column='comparison_positions.source')]),
        dict(id='prices', label='Prices', office='independent', stage='positions', check='Price check', x=590, y=558,
             grain='1 row = security x date x vendor', rules=['PRC_VENDOR_DISPERSION'],
             comes_from=[dict(label='{n} price vendor{s}', evidence='data', column='prices.vendor')]),
        dict(id='fx_rates', label='FX rates', office='independent', stage='positions', check='Price check', x=790, y=558,
             grain='1 row = currency x date', rules=['FX_RATE_VALID'],
             comes_from=[dict(label='FX provider', evidence='reasoning',
                              reason='Our reasoning: fx_rates has no source column.')]),
    ],
    'edges': [
        dict(id='account_check', source='accounts', target='transactions', kind='handoff', handoff=1,
             check='Account check', from_handle='right', to_handle='left-a',
             label='Account check', expected='transactions.account_id → accounts.account_id: many to one',
             rules=['ACC_NOT_OPEN_ON_TRADE_DATE'],
             joins=[dict(id='txn_account', label='transactions.account_id → accounts',
                         left=('transactions', ['account_id']), right=('accounts', ['account_id']),
                         required=['left'], unique=['right'])]),
        dict(id='security_check', source='securities', target='transactions', kind='handoff', handoff=2,
             check='Security check', from_handle='right', to_handle='left-b', tag_at=0.72, tag_side='left',
             label='Security check', expected='transactions.security_id → securities.security_id: many to one',
             rules=['TXN_SECURITY_NOT_MASTERED'],
             joins=[dict(id='txn_security', label='transactions.security_id → securities',
                         left=('transactions', ['security_id']), right=('securities', ['security_id']),
                         required=['left'], unique=['right'])]),
        dict(id='booking', source='transactions', target='pipeline_events', kind='flow',
             from_handle='bottom', to_handle='top',
             label='booked', expected='pipeline_events.transaction_id → transactions.transaction_id: intended one to one; validate first',
             rules=['TXN_PIPELINE_ONE_TO_ONE'],
             joins=[dict(id='pipeline_txn', label='pipeline_events.transaction_id ↔ transactions',
                         left=('pipeline_events', ['transaction_id']), right=('transactions', ['transaction_id']),
                         required=['left', 'right'], unique=['left', 'right'])]),
        dict(id='correction_link', source='transactions', target='transactions', kind='flow',
             from_handle='top', to_handle='top',
             label='correction link', expected='transactions.related_transaction_id → transactions.transaction_id: many to one where populated',
             rules=['TXN_CORRECTION_LINK', 'TXN_ONE_REVERSAL_PER_ORIGINAL'],
             joins=[dict(id='txn_related', label='related_transaction_id → transaction_id',
                         left=('transactions', ['related_transaction_id']), right=('transactions', ['transaction_id']),
                         left_filter="coalesce(related_transaction_id, '') <> ''",
                         required=['left'], unique=['right'])]),
        dict(id='trade_check', source='transactions', target='positions', kind='handoff', handoff=3,
             check='Trade check', from_handle='right', to_handle='top', tag_at=0.45,
             label='Trade check', expected='transactions by account_id + security_id → positions: many to one; aggregate trades before comparing',
             rules=['POS_REBUILD_MATCHES'],
             joins=[dict(id='txn_position', label='transactions (account + security) → positions',
                         left=('transactions', ['account_id', 'security_id']), right=('positions', ['account_id', 'security_id']),
                         required=['left', 'right'], unique=['right'])]),
        dict(id='ca_check', source='corporate_actions', target='positions', kind='handoff', handoff=4, inferred=True,
             check='Corporate action check', from_handle='right', to_handle='bottom-a',
             label='Corporate action check', expected='scenario only: corporate_actions records issuer events, not which accounts received them',
             rules=['CA_ALL_HOLDERS_ADJUSTED'],
             joins=[dict(id='ca_holders', label='corporate_actions.security_id → positions (candidate holders)',
                         left=('corporate_actions', ['security_id']), right=('positions', ['security_id']),
                         required=[], unique=[])]),
        dict(id='ca_securities', source='securities', target='corporate_actions', kind='lookup',
             from_handle='bottom', to_handle='left',
             label='security / target', expected='corporate_actions.security_id and target_security_id → securities: validate source and applicable target',
             rules=[],
             joins=[dict(id='ca_source', label='corporate_actions.security_id → securities',
                         left=('corporate_actions', ['security_id']), right=('securities', ['security_id']),
                         required=['left'], unique=['right']),
                    dict(id='ca_target', label='corporate_actions.target_security_id → securities',
                         left=('corporate_actions', ['target_security_id']), right=('securities', ['security_id']),
                         left_filter="coalesce(target_security_id, '') <> ''",
                         required=['left'], unique=['right'])]),
        dict(id='position_check', source='comparison_positions', target='positions', kind='handoff', handoff=5,
             check='Position check', from_handle='top', to_handle='bottom', tag_side='left',
             label='Position check', expected='positions and comparison_positions on account_id + security_id + as_of_date: full outer comparison after grain checks',
             rules=['POS_CUSTODIAN_BREAK'],
             joins=[dict(id='book_custodian', label='positions ↔ comparison_positions (account + security + date)',
                         left=('positions', ['account_id', 'security_id', 'as_of_date_norm']),
                         right=('comparison_positions', ['account_id', 'security_id', 'as_of_date_norm']),
                         required=['left', 'right'], unique=['left', 'right'])]),
        dict(id='price_check', source='prices', target='positions', kind='handoff', handoff=5,
             check='Price check', from_handle='top', to_handle='bottom-b',
             label='Price check', expected='positions.security_id → prices.security_id: select date and vendor before joining',
             rules=['PRC_QUOTE_ELIGIBLE'],
             joins=[dict(id='position_price', label='positions (security + date) → prices on that date',
                         left=('positions', ['security_id', 'as_of_date_norm']), right=('prices', ['security_id', 'price_date_norm']),
                         required=['left'], unique=[])]),
        dict(id='fx_lookup', source='fx_rates', target='prices', kind='flow',
             from_handle='bottom-a', to_handle='bottom-b', tag_side='above',  # a short U under the two boxes: room for its tag
             label='currency + date', expected='prices.currency and price_date → fx_rates.currency and rate_date: many to one after uniqueness checks',
             rules=['FX_RATE_COVERAGE'],
             joins=[dict(id='price_fx', label='prices (currency + date) → fx_rates',
                         left=('prices', ['currency', 'price_date_norm']), right=('fx_rates', ['currency', 'rate_date_norm']),
                         required=['left'], unique=['right'])]),
        dict(id='price_security', source='securities', target='prices', kind='lookup',
             from_handle='bottom-a', to_handle='left',
             label='security_id', expected='prices.security_id → securities.security_id: many to one',
             rules=[],
             joins=[dict(id='price_master', label='prices.security_id → securities',
                         left=('prices', ['security_id']), right=('securities', ['security_id']),
                         required=['left'], unique=['right'])]),
        dict(id='position_account', source='accounts', target='positions', kind='lookup',
             from_handle='top-a', to_handle='top-a',
             label='account_id', expected='positions.account_id → accounts.account_id: many to one; obtains fund and class',
             rules=['POS_KEYS_MASTERED'],
             joins=[dict(id='position_account_master', label='positions.account_id → accounts',
                         left=('positions', ['account_id']), right=('accounts', ['account_id']),
                         required=['left'], unique=['right'])]),
        dict(id='position_security', source='securities', target='positions', kind='lookup',
             from_handle='right-b', to_handle='left',
             label='security_id', expected='positions.security_id → securities.security_id: many to one',
             rules=['POS_KEYS_MASTERED'],
             joins=[dict(id='position_security_master', label='positions.security_id → securities',
                         left=('positions', ['security_id']), right=('securities', ['security_id']),
                         required=['left'], unique=['right'])]),
        dict(id='nav_check', source='positions', target='ledger_nav', kind='handoff', handoff=6, inferred=True,
             check='NAV check', from_handle='right', to_handle='top',
             label='NAV check', expected='fund valuation aggregates → ledger_nav summed over share classes by fund_id and as_of_date: one to one at fund level',
             rules=['NAV_OPEN_ISSUES_BEFORE_RELEASE'],
             joins=[dict(id='position_ledger', label='positions → account fund + class + date → ledger_nav (roll-up)',
                         left=('positions_fund', ['fund_id', 'share_class', 'as_of_date_norm']),
                         right=('ledger_nav', ['fund_id', 'share_class', 'as_of_date_norm']),
                         required=['left'], unique=['right'])]),
        dict(id='class_mapping', source='accounts', target='ledger_nav', kind='lookup',
             from_handle='top-b', to_handle='top-b',
             label='fund_id + share_class', expected='positions.account_id → accounts obtains fund and class; ledger_nav is per fund + share class + date',
             rules=['NAV_SHARE_CLASS_MAPPING'],
             joins=[dict(id='account_class', label='OPEN accounts (fund + class) ↔ ledger_nav',
                         left=('accounts', ['fund_id', 'share_class']), right=('ledger_nav', ['fund_id', 'share_class']),
                         left_filter="status = 'OPEN'", required=['left', 'right'], unique=[])]),
    ],
}


def checksum(path):
    """Same short checksum as scripts/build_findings.py, so the dashboard and docs/FINDINGS.md name the same run."""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def q(name):
    return '"' + name.replace('"', '""') + '"'


def normalised(column):
    """SQL: YYYY-MM-DD or DD/MM/YYYY text -> YYYY-MM-DD text; NULL when blank or unreadable."""
    c = q(column)
    return (f"strftime(coalesce(try_strptime({c}, '%Y-%m-%d'), try_strptime({c}, '%d/%m/%Y')), '%Y-%m-%d')")


def load_tables(con, manifest):
    loaded = []
    for name, entry in manifest.items():
        path = (MANIFEST_PATH.parent / entry['file']).as_posix().replace("'", "''")
        con.sql(f"CREATE TABLE {q(name)} AS SELECT row_number() OVER () AS source_row, * "
                f"FROM read_csv('{path}', all_varchar=true, header=true)")
        columns = [r[0] for r in con.sql(f"DESCRIBE {q(name)}").fetchall()][1:]
        rows = con.sql(f"SELECT count(*) FROM {q(name)}").fetchone()[0]
        assert rows == int(entry['rows']), f'{name}: manifest says {entry["rows"]} rows, loaded {rows}'
        assert len(columns) == int(entry['columns']), f'{name}: manifest says {entry["columns"]} columns, loaded {len(columns)}'
        unreadable = {}
        for column in DATE_COLUMNS.get(name, []):
            con.sql(f"ALTER TABLE {q(name)} ADD COLUMN {q(column + '_norm')} VARCHAR")
            con.sql(f"UPDATE {q(name)} SET {q(column + '_norm')} = {normalised(column)}")
            unreadable[column] = con.sql(f"SELECT count(*) FROM {q(name)} WHERE coalesce({q(column)}, '') <> '' "
                                         f"AND {q(column + '_norm')} IS NULL").fetchone()[0]
        for column in INDEXES.get(name, []):
            con.sql(f"CREATE INDEX {q(f'ix_{name}_{column}')} ON {q(name)} ({q(column)})")
        loaded.append(dict(table=name, rows=rows, manifest_rows=int(entry['rows']), columns=len(columns),
                           unreadable_dates='; '.join(f'{c}: {n}' for c, n in unreadable.items() if n)))
        print(f'  {name}: {rows:,} rows')
    # positions with the fund + share class of their account (for the roll-up to ledger_nav); account_id is unique
    # in accounts on this release, and an unknown account leaves fund and class blank (a visible blank key).
    con.sql("CREATE VIEW positions_fund AS SELECT p.position_id, p.account_id, p.security_id, p.as_of_date_norm, "
            "a.fund_id, a.share_class FROM positions p LEFT JOIN accounts a USING (account_id)")
    return loaded


def blank(alias, keys):
    return ' OR '.join(f"coalesce({alias}.{q(k)}, '') = ''" for k in keys)


def side_health(con, this, other):
    """Health of one side of a join: `this` and `other` are (table, keys, filter)."""
    (table, keys, where), (o_table, o_keys, o_where) = this, other
    k = ', '.join(q(c) for c in keys)
    match = ' AND '.join(f't.{q(a)} = o.{q(b)}' for a, b in zip(keys, o_keys))
    key_text = " || '/' || ".join(f"t.{q(c)}" for c in keys)
    plain_key_text = " || '/' || ".join(q(c) for c in keys)
    base = f"(SELECT * FROM {q(table)} WHERE {where or 'true'})"
    o_base = f"(SELECT * FROM {q(o_table)} WHERE {o_where or 'true'})"
    con.sql(f"CREATE OR REPLACE TEMP TABLE side_keys AS SELECT {k}, count(*) AS n FROM {base} s "
            f"WHERE NOT ({blank('s', keys)}) GROUP BY ALL")
    con.sql(f"CREATE OR REPLACE TEMP TABLE side_orphans AS SELECT t.*, {key_text} AS key_text FROM side_keys t "
            f"WHERE NOT EXISTS (SELECT 1 FROM {o_base} o WHERE {match})")
    rows, blanks = con.sql(f"SELECT count(*), count(*) FILTER (WHERE {blank('s', keys)}) FROM {base} s").fetchone()
    distinct, max_n, repeated = con.sql("SELECT count(*), coalesce(max(n), 0), count(*) FILTER (WHERE n > 1) "
                                        "FROM side_keys").fetchone()
    orphan_keys, orphan_rows = con.sql("SELECT count(*), coalesce(sum(n), 0) FROM side_orphans").fetchone()
    sample = [r[0] for r in con.sql("SELECT key_text FROM side_orphans ORDER BY key_text LIMIT 5").fetchall()]
    repeated_sample = [r[0] for r in con.sql(f"SELECT {plain_key_text} FROM side_keys "
                                              f"WHERE n > 1 ORDER BY n DESC, 1 LIMIT 5").fetchall()]
    return dict(rows=rows, blank_key_rows=blanks, distinct_keys=distinct, max_rows_per_key=max_n,
                repeated_keys=repeated, orphan_keys=orphan_keys, orphan_rows=int(orphan_rows),
                sample_orphans='; '.join(sample), sample_repeated='; '.join(repeated_sample))


def join_health(con):
    lines = []
    for edge in GRAPH['edges']:
        for join in edge['joins']:
            left = (join['left'][0], join['left'][1], join.get('left_filter'))
            right = (join['right'][0], join['right'][1], None)
            sides = {'left': side_health(con, left, right), 'right': side_health(con, right, left)}
            cardinality = ' to '.join('many' if sides[s]['max_rows_per_key'] > 1 else 'one' for s in ('left', 'right'))
            for side, (table, keys, where) in (('left', left), ('right', right)):
                h = sides[side]
                required, unique = side in join['required'], side in join['unique']
                if required and h['orphan_keys']:
                    status = 'orphans'
                elif unique and h['max_rows_per_key'] > 1:
                    status = 'fan_out'
                elif required and h['blank_key_rows']:
                    status = 'blank_keys'
                elif required or unique:
                    status = 'ok'
                else:
                    status = 'info'
                lines.append(dict(edge_id=edge['id'], join_id=join['id'], join_label=join['label'], side=side,
                                  table_name=table, keys=' + '.join(keys), filter=where or '',
                                  required=required, unique_expected=unique, observed_cardinality=cardinality,
                                  status=status, **h))
            print(f"  {join['id']}: {cardinality}; " + ', '.join(
                f"{s} {lines[-2 if s == 'left' else -1]['status']}" for s in ('left', 'right')))
    return lines


def table_cells(text):
    """The cells of a Markdown table row (without its outer pipes); an escaped pipe (\\|) stays in its cell, unescaped."""
    return [c.strip().replace('\\|', '|') for c in re.split(r'(?<!\\)\|', text)]


def rule_catalog():
    """Every rule row in docs/RULES.md: | `ID` | test | on fail | note |, with the section it sits in."""
    rules, section = [], ''
    for line in RULES_MD.read_text(encoding='utf-8').splitlines():
        if line.startswith('## '):
            section = re.sub(r'^##\s+(\d+\.\s*)?', '', line).strip()
        found = re.match(r'^\|\s*`([A-Z_]+)`\s*\|(.*)\|\s*$', line)
        if found:
            cells = table_cells(found.group(2))
            rules.append(dict(rule_id=found.group(1), section=section, test=cells[0] if cells else '',
                              on_fail=cells[1] if len(cells) > 1 else '', note=cells[2] if len(cells) > 2 else ''))
    return rules


def load_framework():
    """The seven checks of our framework (scripts/framework.json), keyed by check name: owner and office."""
    return {c['check']: c for c in json.loads(FRAMEWORK.read_text(encoding='utf-8'))['checks']}


def source_label(template, values):
    """The text of a 'comes from' chip: {n} = how many distinct values the data holds. None when it holds none."""
    if not values:
        return None
    return template.format(n=len(values), s='' if len(values) == 1 else 's')


def place_of(node, offices, stages, framework):
    """Where a table sits, in words: 'Middle office · Positions', or who checks an independent source."""
    if offices[node['office']]['kind'] == 'independent':
        return 'Independent source · checked by the ' + framework[node['check']]['office'].lower()
    return f"{node.get('office_label') or offices[node['office']]['label']} · {stages[node['stage']]['label']}"


def map_place(rule_id):
    """The one map element a register line counts on: the table its rule sits on, else its line, else none."""
    for kind, items in (('node', GRAPH['nodes']), ('edge', GRAPH['edges'])):
        for item in items:
            if rule_id in item['rules']:
                return kind, item['id']
    return '', ''


HANDLE = re.compile(r'(top|right|bottom|left)(-a|-b)?')


def check_graph(catalog, framework, graph=GRAPH):
    """The graph agrees with the framework and docs/RULES.md: offices, checks, owners and where each rule counts."""
    offices = {o['id']: o for o in graph['offices']}
    stages = {s['id']: s for s in graph['stages']}
    section = {r['rule_id']: r['section'] for r in catalog}
    for n in graph['nodes']:
        assert n['office'] in offices and n['stage'] in stages, f"{n['id']}: unknown office or stage"
        assert n['check'] in framework, f"{n['id']}: check {n['check']!r} is not in scripts/framework.json"
        if offices[n['office']]['kind'] == 'office':
            assert framework[n['check']]['office'] == offices[n['office']]['label'], \
                f"{n['id']} sits in {offices[n['office']]['label']} but its check belongs to {framework[n['check']]['office']}"
        wrong = [r for r in n['rules'] if section[r] != n['check']]
        assert not wrong, f"{n['id']}: rules from another check's section of docs/RULES.md: {wrong}"
        for chip in n.get('comes_from', []):
            assert chip['evidence'] in ('data', 'reasoning'), f"{n['id']}: evidence {chip['evidence']!r}"
            assert chip.get('column') if chip['evidence'] == 'data' else chip.get('reason'), f"{n['id']}: chip basis"
    for e in graph['edges']:
        assert ('check' in e) == (e['kind'] == 'handoff'), f"{e['id']}: only handoffs carry a check"
        if 'check' in e:
            assert e['check'] in framework, f"{e['id']}: check not in scripts/framework.json"
            assert framework[e['check']]['handoff'] == e['handoff'], f"{e['id']}: {e['check']} is not handoff {e['handoff']}"
        assert HANDLE.fullmatch(e['from_handle']) and HANDLE.fullmatch(e['to_handle']), f"{e['id']}: unknown handle"
        assert 0 <= e.get('tag_at', 0.5) <= 1 and e.get('tag_side', 'right') in ('left', 'right', 'above', 'below'), \
            f"{e['id']}: tag_at must be 0-1 and tag_side left, right, above or below"
    for rule in {r for item in graph['nodes'] + graph['edges'] for r in item['rules']}:
        on_nodes = [n['id'] for n in graph['nodes'] if rule in n['rules']]
        on_edges = [e for e in graph['edges'] if rule in e['rules']]
        assert len(on_nodes) <= 1 and (on_nodes or len(on_edges) <= 1), \
            f'{rule} sits on {on_nodes + [e["id"] for e in on_edges]}: a register line must count on one place only'
        assert on_nodes or on_edges[0]['kind'] != 'lookup', \
            f"{rule} counts on the lookup {on_edges[0]['id']}, hidden by default: place it on its table too"


def distinct_values(con, table, column):
    """The distinct labels in a column, trimmed; blank and whitespace-only values are left out."""
    c = q(column)
    return [r[0] for r in con.sql(f"SELECT DISTINCT trim({c}) FROM {q(table)} "
                                  f"WHERE trim(coalesce({c}, '')) <> '' ORDER BY 1").fetchall()]


def source_chips(con):
    """Each table's 'comes from' chips; data chips get their distinct values from the loaded table."""
    chips = []
    for n in GRAPH['nodes']:
        for position, chip in enumerate(n.get('comes_from', []), 1):
            values = []
            if chip['evidence'] == 'data':
                table, column = chip['column'].split('.')
                assert column in [r[0] for r in con.sql(f"DESCRIBE {q(table)}").fetchall()], f"{chip['column']} missing"
                values = distinct_values(con, table, column)
                label = source_label(chip['label'], values)
                if label is None:
                    print(f"  {chip['column']} is blank everywhere: no 'comes from' chip on {n['id']}")
                    continue
            else:
                label = chip['label']
            chips.append(dict(node_id=n['id'], position=position, label=label, evidence=chip['evidence'],
                              column_ref=chip.get('column', ''), source_values='; '.join(values),
                              reason=chip.get('reason', '')))
    return chips


def read_register():
    if not REGISTER.is_file():
        print(f'  no register at {REGISTER.relative_to(ROOT) if REGISTER.is_relative_to(ROOT) else REGISTER}: '
              f'map without rule counts')
        return [], []
    with REGISTER.open(newline='', encoding='utf-8') as stream:
        rows = list(csv.DictReader(stream))
    register, examples = [], []
    for order, row in enumerate(rows, 1):
        rule_id = row['rule'].split()[0] if row['rule'].strip() else ''
        map_kind, map_id = map_place(rule_id)
        register.append(dict(line=order, rule_id=rule_id, rule=row['rule'], finding=row['finding'],
                             status=row['status'], stage=row['stage'], unit=row['unit'], affected=row['affected'],
                             eligible=row['eligible'], not_evaluable=row['not evaluable'],
                             population=row['population'], examples=row['examples'], id_kind=row['id kind'],
                             how_detected=row['how detected'], map_kind=map_kind, map_id=map_id))
        for example in [e.strip() for e in row['examples'].split(',') if e.strip()]:
            examples.append(dict(line=order, rule_id=rule_id, finding=row['finding'], status=row['status'],
                                 id_kind=row['id kind'], record_id=example))
    return register, examples


TRACEABLE = {'transaction_id', 'account_id', 'security_id', 'account/security', 'action_id', 'ledger_id'}


def demo_traces(register):
    demos, seen = [], set()
    if TRACE.is_file():
        with TRACE.open(newline='', encoding='utf-8') as stream:
            for row in csv.DictReader(stream):
                if row['hop'] == 'source' and row['field'] == 'transaction_id' and row['value'] not in seen:
                    seen.add(row['value'])
                    demos.append(dict(record_id=row['value'], label='The evidenced trace (Check-in 2 story)',
                                      status='trace', source='outputs/02_trace.csv'))
    order = {'confirmed': 0, 'unresolved': 1, 'cleared': 2}
    for line in sorted(register, key=lambda r: (order.get(r['status'], 3), r['line'])):
        first = next((e.strip() for e in line['examples'].split(',') if e.strip()), '')
        if line['id_kind'] in TRACEABLE and first and first not in seen:
            seen.add(first)
            demos.append(dict(record_id=first, label=line['finding'], status=line['status'],
                              source=f"register line {line['line']} ({line['rule_id']})"))
    return [dict(position=i, **d) for i, d in enumerate(demos, 1)]


def write_rows(con, table, rows, columns=None):
    """Create `table` from a list of dicts (text, integer and boolean columns)."""
    if not rows and not columns:
        raise ValueError(f'{table}: no rows and no columns')
    columns = columns or list(rows[0])
    def sql_type(column):
        values = [r[column] for r in rows if r.get(column) is not None]
        if values and all(isinstance(v, bool) for v in values):
            return 'BOOLEAN'
        if values and all(isinstance(v, int) and not isinstance(v, bool) for v in values):
            return 'BIGINT'
        if values and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in values):
            return 'DOUBLE'
        return 'VARCHAR'
    con.sql(f"CREATE TABLE {q(table)} ({', '.join(f'{q(c)} {sql_type(c)}' for c in columns)})")
    if rows:
        con.executemany(f"INSERT INTO {q(table)} VALUES ({', '.join('?' for _ in columns)})",
                        [[r.get(c) for c in columns] for r in rows])


def main():
    with MANIFEST_PATH.open(newline='', encoding='utf-8') as stream:
        manifest = {row['table']: row for row in csv.DictReader(stream)}
    snapshot = tomllib.loads(CONFIG_PATH.read_text(encoding='utf-8'))['snapshot']['as_of_date']
    catalog = rule_catalog()
    known = {r['rule_id'] for r in catalog}
    placed = [(r, 'node', n['id']) for n in GRAPH['nodes'] for r in n['rules']]
    placed += [(r, 'edge', e['id']) for e in GRAPH['edges'] for r in e['rules']]
    unknown = sorted({r for r, _, _ in placed} - known)
    assert not unknown, f'rule IDs in the graph that docs/RULES.md does not define: {unknown}'
    assert set(manifest) == {n['id'] for n in GRAPH['nodes']}, 'the graph and the manifest name different tables'
    framework = load_framework()
    check_graph(catalog, framework)

    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = STORE_PATH.with_name(STORE_PATH.name + '.building')
    temporary.unlink(missing_ok=True)
    con = duckdb.connect(str(temporary))
    print(f'Loading {len(manifest)} tables from {MANIFEST_PATH.name} (as text)')
    loaded = {t['table']: t for t in load_tables(con, manifest)}

    offices = {o['id']: o for o in GRAPH['offices']}
    stages = {s['id']: s for s in GRAPH['stages']}
    write_rows(con, 'map_offices', GRAPH['offices'])
    write_rows(con, 'map_stages', GRAPH['stages'])
    write_rows(con, 'map_nodes', [dict(id=n['id'], label=n['label'], office=n['office'], stage=n['stage'],
                                       place=place_of(n, offices, stages, framework), check=n['check'],
                                       owner=framework[n['check']]['owner'],
                                       check_office=framework[n['check']]['office'], x=n['x'], y=n['y'],
                                       grain=n['grain'], note=n.get('note', ''),
                                       rows=loaded[n['id']]['rows'], manifest_rows=loaded[n['id']]['manifest_rows'],
                                       columns=loaded[n['id']]['columns'],
                                       unreadable_dates=loaded[n['id']]['unreadable_dates'])
                                  for n in GRAPH['nodes']])
    write_rows(con, 'map_sources', source_chips(con),
               columns=['node_id', 'position', 'label', 'evidence', 'column_ref', 'source_values', 'reason'])
    write_rows(con, 'map_edges', [dict(id=e['id'], source=e['source'], target=e['target'], kind=e['kind'],
                                       handoff=e.get('handoff'), label=e['label'], expected=e['expected'],
                                       inferred=bool(e.get('inferred', False)), check=e.get('check', ''),
                                       owner=framework[e['check']]['owner'] if 'check' in e else '',
                                       check_office=framework[e['check']]['office'] if 'check' in e else '',
                                       from_handle=e['from_handle'], to_handle=e['to_handle'],
                                       tag_at=float(e.get('tag_at', 0.5)), tag_side=e.get('tag_side', 'right'))
                                  for e in GRAPH['edges']],
               columns=['id', 'source', 'target', 'kind', 'handoff', 'label', 'expected', 'inferred', 'check',
                        'owner', 'check_office', 'from_handle', 'to_handle', 'tag_at', 'tag_side'])
    write_rows(con, 'rule_placement', [dict(rule_id=r, target_kind=k, target_id=t) for r, k, t in placed])
    write_rows(con, 'rule_catalog', catalog)

    print('Join health (raw keys)')
    write_rows(con, 'join_health', join_health(con))

    register, examples = read_register()
    register_columns = ['line', 'rule_id', 'rule', 'finding', 'status', 'stage', 'unit', 'affected', 'eligible',
                        'not_evaluable', 'population', 'examples', 'id_kind', 'how_detected', 'map_kind', 'map_id']
    write_rows(con, 'register', register, columns=register_columns)
    write_rows(con, 'register_examples', examples,
               columns=['line', 'rule_id', 'finding', 'status', 'id_kind', 'record_id'])
    write_rows(con, 'demo_traces', demo_traces(register),
               columns=['position', 'record_id', 'label', 'status', 'source'])
    unplaced = sorted({r['rule_id'] for r in register} - {r for r, _, _ in placed})
    if unplaced:
        print(f'  register rules not on the map: {unplaced}')

    with DICTIONARY.open(newline='', encoding='utf-8') as stream:
        write_rows(con, 'column_dictionary', [dict(table_name=r['table'], column_name=r['column'],
                                                   intended_type=r['intended_type'], description=r['description'])
                                              for r in csv.DictReader(stream)])
    write_rows(con, 'store_info', [dict(
        built_at=datetime.now().isoformat(timespec='seconds'), snapshot_date=snapshot,
        manifest=MANIFEST_PATH.relative_to(ROOT).as_posix() if MANIFEST_PATH.is_relative_to(ROOT) else str(MANIFEST_PATH),
        manifest_checksum=checksum(MANIFEST_PATH),
        register_checksum=checksum(REGISTER) if REGISTER.is_file() else '',
        register_lines=len(register))])
    con.close()
    os.replace(temporary, STORE_PATH)
    print(f'Store written: {STORE_PATH.relative_to(ROOT) if STORE_PATH.is_relative_to(ROOT) else STORE_PATH}')


if __name__ == '__main__':
    sys.exit(main())
