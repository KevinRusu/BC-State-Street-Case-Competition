#!/usr/bin/env bash
# Run the deliverable notebook on the small made-up fixture in tests/fixtures/small (same schema as the release; no
# row copied from data/) and compare what it finds with what the fixture was built to contain. Outputs go to
# run_fixture_*, never to outputs/. Runs: default config, rows shuffled, holding_date = settlement, a trace flag no key
# carries, an edge copy of the fixture (built below in tests/runs/fixture_edge) with inputs the release does not
# contain, an R3 copy under the R3 reading (its severity section is checked too), and a quality copy (built below in
# tests/runs/fixture_quality) with the price, FX and trade quality cases, run as is and with a T+3 settlement limit.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
W=tests/runs
mkdir -p "$W"
export RECONCILIATION_DATA=tests/fixtures/small/manifest.csv
uv run --quiet python - <<'PY'
base = open('config/reconciliation.toml').read()
W = 'tests/runs'
for name, old, new in [('shuffled', 'shuffle_seed = 0', 'shuffle_seed = 3'),
                       ('settlement', 'holding_date = "trade"', 'holding_date = "settlement"'),
                       ('notrace', 'flag = "sign_conflict"', 'flag = "rebook_old_gross"'),
                       ('lag3', 'settlement_lag_limit_business_days = 2', 'settlement_lag_limit_business_days = 3')]:
    assert old in base, f'config has no line {old!r}'
    open(f'{W}/config_fixture_{name}.toml', 'w').write(base.replace(old, new))
PY
# Edge fixture: a copy of tests/fixtures/small with the cases a schema-compatible file may hold and the release does
# not (built here, so the default fixture and its expected outcomes stay as they are).
uv run --quiet python - <<'PY'
import csv, shutil
src, dst = 'tests/fixtures/small', 'tests/runs/fixture_edge'
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(src, dst)
def edit(table, change):
    path = f'{dst}/{table}.csv'
    with open(path, newline='') as stream:
        reader = csv.DictReader(stream)
        fields, rows = reader.fieldnames, list(reader)
    rows = change(rows, fields)
    with open(path, 'w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)
def add(*lines):
    return lambda rows, fields: rows + [dict(zip(fields, line.split(','))) for line in lines]
def set_field(match, field, value, then=None):
    def change(rows, fields):
        for row in rows:
            if all(row[k] == v for k, v in match.items()):
                row[field] = value
        return then(rows, fields) if then else rows
    return change
counts = {
    # Negative BUY whose gross_amount fits neither sign, on an account missing from accounts, with no pipeline record;
    # it sorts first, so it is the traced key. Then: one original reversed by one REVERSED row delivered twice, and
    # two REVERSED rows with no link (all on a key that is already not evaluable).
    'transactions': edit('transactions', add(
        'FXT30,FXACC0,FXSEC3,FXCUSIP03,BUY,2026-06-15,2026-06-17,-10,5.00,USD,20.00,BOOKED,,FIXTURE_OMS,2026-06-15 09:00:00,',
        'FXT31,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-16,2026-06-18,15,5.00,USD,75.00,BOOKED,,FIXTURE_OMS,2026-06-16 09:00:00,',
        'FXT32,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-16,2026-06-18,15,5.00,USD,75.00,REVERSED,FXT31,FIXTURE_OMS,2026-06-16 10:00:00,',
        'FXT32,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-16,2026-06-18,15,5.00,USD,75.00,REVERSED,FXT31,FIXTURE_OMS,2026-06-16 10:00:00,',
        'FXT33,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-17,2026-06-19,5,5.00,USD,25.00,REVERSED,,FIXTURE_OMS,2026-06-17 10:00:00,',
        'FXT34,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-18,2026-06-22,5,5.00,USD,25.00,REVERSED,,FIXTURE_OMS,2026-06-18 10:00:00,',
        # Blank quantities: one whose size is in the row (50.00 / 5.00 = 10 units; book and custodian leave it out),
        # and one linked to another trade (held, never derived).
        'FXT40,FXACC1,FXSEC3,FXCUSIP03,BUY,2026-06-15,2026-06-17,20,5.00,USD,100.00,BOOKED,,FIXTURE_OMS,2026-06-15 09:00:00,',
        'FXT41,FXACC1,FXSEC3,FXCUSIP03,BUY,2026-06-16,2026-06-18,,5.00,USD,50.00,BOOKED,,FIXTURE_OMS,2026-06-16 09:00:00,',
        'FXT42,FXACC2,FXSEC2,FXCUSIP02,BUY,2026-06-16,2026-06-18,,10.00,EUR,100.00,BOOKED,FXT01,FIXTURE_OMS,2026-06-16 09:00:00,',
        # A CANCELLED trade delivered twice with two quantities (10 and 12), and its rebook: gross_amount 50.00 fits
        # the first copy only, so which copy the rebook is compared with must not depend on file order.
        'FXT60,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-19,2026-06-23,10,5.00,USD,50.00,CANCELLED,,FIXTURE_OMS,2026-06-19 09:00:00,',
        'FXT60,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-19,2026-06-23,12,5.00,USD,60.00,CANCELLED,,FIXTURE_OMS,2026-06-19 09:00:00,',
        'FXT61,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-19,2026-06-23,8,5.00,USD,50.00,BOOKED,FXT60,FIXTURE_OMS,2026-06-19 10:00:00,')),
    # Book row dated DD/MM/YYYY (same snapshot), the traced key in the book, the blank-quantity key without its units,
    # and a row for an existing key on the day before the snapshot (outside the comparison, never joined to it).
    'positions': edit('positions', set_field({'position_id': 'FXP1'}, 'as_of_date', '10/07/2026',
                                             add('FXP8,FXACC0,FXSEC3,-10,1,2026-07-10,BOOK_OF_RECORD',
                                                 'FXP9,FXACC1,FXSEC3,20,2,2026-07-10,BOOK_OF_RECORD',
                                                 'FXP10,FXACC1,FXSEC2,999,2,2026-07-09,BOOK_OF_RECORD',
                                                 'FXP11,FXACC1,FXSEC2,999,2,not-a-date,BOOK_OF_RECORD'))),
    # The traced key at the custodian, a custodian row with quantity 0 (the custodian reports a flat position), the
    # blank-quantity key holding the same as the book, and a custodian row on the day before the snapshot.
    'comparison_positions': edit('comparison_positions', add('FXC8,FXACC0,FXSEC3,-10,2026-07-10,CUSTODIAN_FEED',
                                                             'FXC9,FXACC2,FXSEC2,0,2026-07-10,CUSTODIAN_FEED',
                                                             'FXC10,FXACC1,FXSEC3,20,2026-07-10,CUSTODIAN_FEED',
                                                             'FXC11,FXACC1,FXSEC2,999,2026-07-09,CUSTODIAN_FEED')),
    # USD rate on the snapshot is not 1 (the traced security is quoted in USD), and a USD rate that does not parse.
    'fx_rates': edit('fx_rates', set_field({'currency': 'USD', 'rate_date': '2026-07-10'}, 'rate_to_usd', '0.990000',
                                           add('USD,2026-07-08,n/a'))),
    # FXSEC1 on the snapshot: both quotes come from one vendor.
    'prices': edit('prices', set_field({'security_id': 'FXSEC1', 'price_date': '2026-07-10', 'vendor': 'FIXTURE_V2'},
                                       'vendor', 'FIXTURE_V1')),
    # The same fund + class + date written in the other date format, and a row with an unreadable date.
    'ledger_nav': edit('ledger_nav', add('FXL3,FXFUND1,A,1000000.00,10/07/2026,100000,10.000000',
                                         'FXL4,FXFUND1,C,200000.00,not-a-date,20000,10.000000')),
}
# Timeliness (D-065): pipeline timestamps edited on existing IDs, one case per feed-day. FXT01, FXT03 and FXT04 move to
# OMS_FRONT so the configured limits apply (FIXTURE_OMS has none).
def set_fields(match, **values):
    def change(rows, fields):
        for row in rows:
            if all(row[k] == v for k, v in match.items()):
                row.update(values)
        return rows
    return change
def second_copy(transaction_id, **values):   # only the second of two pipeline rows with this ID
    def change(rows, fields):
        hits = [row for row in rows if row['transaction_id'] == transaction_id]
        hits[1].update(values)
        return rows
    return change
for change in [
    set_fields({'transaction_id': 'FXT01'}, source_system='OMS_FRONT', received_timestamp='2026-06-02 10:00:00',
               booked_timestamp='2026-06-02 10:05:00', published_timestamp='2026-06-02 17:59:00'),  # feed 60 = limit; on time
    set_fields({'transaction_id': 'FXT03'}, source_system='OMS_FRONT', received_timestamp='2026-06-03 10:01:00',
               booked_timestamp='2026-06-03 10:10:00'),                                            # feed latency 61
    set_fields({'transaction_id': 'FXT04'}, source_system='OMS_FRONT', booked_timestamp='2026-06-04 13:06:00'),  # processing 241
    set_fields({'transaction_id': 'FXT05'}, event_timestamp='05/06/2026 09:00:00'),       # DD/MM/YYYY: parsed
    set_fields({'transaction_id': 'FXT06'}, received_timestamp=''),                       # missing
    set_fields({'transaction_id': 'FXT07'}, received_timestamp='2026-06-10T09:05:00'),    # unparseable
    set_fields({'transaction_id': 'FXT08'}, booked_timestamp='not-a-time'),               # unparseable
    set_fields({'transaction_id': 'FXT09'}, booked_timestamp='2026-07-09 18:00:00'),      # booked at the cutoff: on time
    set_fields({'transaction_id': 'FXT10'}, cutoff_timestamp=''),                         # missing; day from the event
    set_fields({'transaction_id': 'FXT13'}, booked_timestamp='2026-06-12 18:01:00'),      # booked after the cutoff
    set_fields({'transaction_id': 'FXT23'}, published_timestamp='2026-06-12 09:08:00'),   # published before booked
    second_copy('FXT02', published_timestamp='2026-06-10 17:00:00',                       # copies disagree: later wins;
                booked_timestamp='2026-06-10 09:00:00'),                                  # this copy also books before receipt
]:
    edit('pipeline_events', change)
# FXT31 twice: copy A takes 5 min to arrive and 55 to book, copy B the reverse. Each latency is the longest per copy
# (55 and 55); taking the latest received of the two would make processing look like 5 minutes.
counts['pipeline_events'] = edit('pipeline_events', add(
    'FXT31,FIXTURE_OMS,2026-06-16 09:00:00,2026-06-16 09:05:00,2026-06-16 10:00:00,FXBATCH-2026-06-16,2026-06-16 17:00:00,2026-06-16 18:00:00',
    'FXT31,FIXTURE_OMS,2026-06-16 09:00:00,2026-06-16 09:55:00,2026-06-16 10:00:00,FXBATCH-2026-06-16,2026-06-16 17:00:00,2026-06-16 18:00:00',
    # FXT33 twice: one copy has no received time, the other has one -> missing, never the readable copy.
    'FXT33,FIXTURE_OMS,2026-06-17 10:00:00,,2026-06-17 10:10:00,FXBATCH-2026-06-17,2026-06-17 17:00:00,2026-06-17 18:00:00',
    'FXT33,FIXTURE_OMS,2026-06-17 10:00:00,2026-06-17 10:05:00,2026-06-17 10:10:00,FXBATCH-2026-06-17,2026-06-17 17:00:00,2026-06-17 18:00:00',
    # FXT34 on OMS_FRONT: blank received and unreadable booked -> processing is missing (missing before unparseable),
    # and its feed-day has no eligible record.
    'FXT34,OMS_FRONT,2026-06-18 10:00:00,,not-a-time,FXBATCH-2026-06-18,2026-06-18 17:00:00,2026-06-18 18:00:00',
    # FXT61 on OMS_FRONT: processing exactly 240 minutes = the limit -> not above it.
    'FXT61,OMS_FRONT,2026-06-19 10:00:00,2026-06-19 10:05:00,2026-06-19 14:05:00,FXBATCH-2026-06-19,2026-06-19 17:00:00,2026-06-19 18:00:00',
    # FXT90: a pipeline record with no trade, no readable event and no cutoff -> day 'unknown', not judged as a day.
    'FXT90,OMS_FRONT,,2026-06-19 09:05:00,2026-06-19 09:10:00,FXBATCH-2026-06-19,2026-06-19 17:00:00,'))
edit('manifest', lambda rows, fields: [{**row, 'rows': str(counts.get(row['table'], row['rows']))} for row in rows])
# R3 fixture: the edge fixture plus a negative BUY that is reversed by a negative REVERSED row (on a key only the
# trades hold). Under R3 the two rows cancel, so reading the sign as wrong must move the holding by 0.
dst, edge = 'tests/runs/fixture_r3', dst
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(edge, dst)
# Also, each on a key nothing else makes not evaluable: an R3 orphan (a REVERSED row pointing at an ID that does not
# exist), a REVERSED row with a blank quantity (the release's case), a CANCELLED row with a blank transaction_id (it
# must not turn every unlinked trade into its rebook), and a negative REVERSED row on the traced key that sorts first,
# so the trace follows a row the R3 chain offsets.
counts = {'transactions': edit('transactions', add(
    'FXT50,FXACC9,FXSEC3,FXCUSIP03,BUY,2026-06-22,2026-06-24,-10,5.00,USD,50.00,BOOKED,,FIXTURE_OMS,2026-06-22 09:00:00,',
    'FXT51,FXACC9,FXSEC3,FXCUSIP03,BUY,2026-06-22,2026-06-24,-10,5.00,USD,50.00,REVERSED,FXT50,FIXTURE_OMS,2026-06-22 10:00:00,',
    'FXT57,FXACC8,FXSEC3,FXCUSIP03,BUY,2026-06-22,2026-06-24,10,5.00,USD,50.00,BOOKED,,FIXTURE_OMS,2026-06-22 09:00:00,',
    'FXT58,FXACC8,FXSEC3,FXCUSIP03,BUY,2026-06-23,2026-06-25,5,5.00,USD,25.00,REVERSED,FXT98,FIXTURE_OMS,2026-06-23 10:00:00,',
    'FXT54,FXACC7,FXSEC3,FXCUSIP03,BUY,2026-06-22,2026-06-24,10,5.00,USD,50.00,BOOKED,,FIXTURE_OMS,2026-06-22 09:00:00,',
    'FXT55,FXACC7,FXSEC3,FXCUSIP03,BUY,2026-06-22,2026-06-24,,5.00,USD,50.00,REVERSED,FXT54,FIXTURE_OMS,2026-06-22 10:00:00,',
    ',FXACC7,FXSEC3,FXCUSIP03,BUY,2026-06-21,2026-06-23,3,5.00,USD,15.00,CANCELLED,,FIXTURE_OMS,2026-06-21 09:00:00,',
    'FXT29,FXACC0,FXSEC3,FXCUSIP03,BUY,2026-06-15,2026-06-17,-10,5.00,USD,50.00,REVERSED,FXT30,FIXTURE_OMS,2026-06-15 10:00:00,'))}
edit('manifest', lambda rows, fields: [{**row, 'rows': str(counts.get(row['table'], row['rows']))} for row in rows])
PY
# Quality fixture: a copy of tests/fixtures/small with one case per price, FX and trade quality check (quality-checks
# spec §7). A third vendor, FIXTURE_V3, has priority 3. Quote timestamps are 17:00:00 on the price date unless stated.
# No pipeline records are added; positions FXQP* have no trades and no custodian row (not asserted).
uv run --quiet python - <<'PY'
import csv, shutil
src, dst = 'tests/fixtures/small', 'tests/runs/fixture_quality'
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(src, dst)
def edit(table, change):
    path = f'{dst}/{table}.csv'
    with open(path, newline='') as stream:
        reader = csv.DictReader(stream)
        fields, rows = reader.fieldnames, list(reader)
    rows = change(rows, fields)
    with open(path, 'w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)
def add(*lines):
    return lambda rows, fields: rows + [dict(zip(fields, line.split(','))) for line in lines]
S, D = '2026-07-10', '2026-07-09'
SECURITIES, BONDS = range(4, 22), {12, 13}
def quote(n, day, vendor, price, currency='USD', stamp=None):
    stamp = f'{day} 17:00:00' if stamp is None else stamp
    return f'FXSEC{n},{day},FIXTURE_V{vendor},{price},{currency},{stamp},{vendor}'
def trade(tid, account, security, kind, trade_day, settle_day, quantity, price, gross, status, rel='', note=''):
    currency = 'EUR' if security == 'FXSEC2' else 'USD'
    return (f'{tid},{account},{security},FXCUSIP0{security[-1]},{kind},{trade_day},{settle_day},{quantity},{price},'
            f'{currency},{gross},{status},{rel},FIXTURE_OMS,{trade_day} 09:00:00,{note}')
EXT = 'EXTENDED_SETTLEMENT_AGREED'
counts = {
    # FXSEC4-FXSEC21 mastered in USD (FXSEC12 and FXSEC13 are bonds); FXSEC22 mastered with a blank currency;
    # FXSEC90 is held and quoted but not mastered.
    'securities': edit('securities', add(*[
        f"FXSEC{n},FXCUSIP{n:02d},FX00000000{n:02d},FXQ{n},Fixture {'Bond' if n in BONDS else 'Equity'} {n},"
        f"{'BOND' if n in BONDS else 'EQUITY'},USD,XFIX,US,,," for n in SECURITIES],
        'FXSEC22,FXCUSIP22,FX0000000022,FXQ22,Fixture Equity 22,EQUITY,,XFIX,US,,,')),
    'positions': edit('positions', add(*[f'FXQP{n},FXACC1,FXSEC{n},10,1,{S},BOOK_OF_RECORD'
                                         for n in [*SECURITIES, 22, 90]])),
    'prices': edit('prices', add(
        quote(4, D, 1, '10.00'),                                              # coverage fail: no snapshot quote
        quote(5, S, 1, ''), quote(5, S, 2, '10.00'),                          # fallback-only
        quote(90, S, 1, '10.00'),                                             # not mastered, quoted: not evaluable
        f'FXSEC18,not-a-date,FIXTURE_V1,10.00,USD,{S} 17:00:00,1',           # unreadable price_date only: not evaluable
        quote(6, S, 1, '10.00', stamp=f'{S} 18:00:00'), quote(6, S, 2, '10.01'),   # fresh at the cutoff
        quote(7, S, 1, '10.00', stamp=f'{S} 18:01:00'), quote(7, S, 2, '10.01'),   # stale, fresh fallback
        quote(8, S, 1, '10.00', stamp='2026-07-11 09:00:00'),                      # stale (other day), and the
        quote(8, S, 2, '10.01', stamp='2026-07-11 09:00:00'),                      # fallback is no fresher
        quote(9, S, 1, '10.00', stamp=''), quote(9, S, 2, '10.01'),                # freshness not evaluable
        *[quote(10, day, 1, '10.00') for day in ['2026-07-03', '2026-07-06', '2026-07-07', '2026-07-08', D, S]],
        quote(10, S, 2, '10.01'),                                             # flat run of 6 across a weekend
        *[quote(11, day, 1, '10.00') for day in ['2026-07-07', D, S]],
        quote(11, S, 2, '10.01'),                                             # no quote on 8 July: run of 2
        quote(12, S, 1, '0.95'), quote(12, S, 2, '95.00'), quote(12, S, 3, '95.02'),     # scale, chosen is odd
        quote(13, S, 1, '95.00'), quote(13, S, 2, '95.01'), quote(13, S, 3, '0.9502'),   # scale, backed
        quote(14, S, 1, '10.20'), quote(14, S, 2, '10.00'), quote(14, S, 3, '10.01'),    # spread, chosen is odd
        quote(14, D, 1, '1.00'), quote(14, D, 2, '100.00'), quote(14, D, 3, '100.10'),    # earlier dates: scale (not
        quote(14, '2026-07-08', 1, '10.20'), quote(14, '2026-07-08', 2, '10.00'),        # also spread), spread, and
        quote(14, '2026-07-08', 3, '10.01'), *[quote(14, '2026-07-07', v, p)             # not flagged
                                               for v, p in [(1, '10.00'), (2, '10.00'), (3, '10.01')]],
        quote(15, S, 1, '10.00'), quote(15, S, 2, '10.01'), quote(15, S, 3, '10.30'),    # spread, backed
        quote(16, S, 1, '10.00'), quote(16, S, 2, '10.20'), quote(16, S, 3, '10.40'),    # spread, no two agree
        quote(17, S, 1, '10.00', 'EUR'), quote(17, S, 2, '10.30', 'EUR'),              # only EUR; master USD
        quote(19, S, 1, 'inf'),                                                         # infinite price: unreadable
        quote(20, S, 1, '10.00'), quote(20, S, 2, '10.04'), quote(20, S, 3, '10.08'),  # spread, backed; V1 and V3
                                                                                        # tie on the median distance
        quote(21, S, 1, '10.00'), quote(21, S, 2, '10.10'), quote(21, S, 3, '10.11'),  # spread, chosen is odd; V4 is
        quote(21, S, 4, '12.00'),                                                       # farther from the median
        quote(22, S, 1, '10.00', ''))),                                                 # blank currency both sides
    'fx_rates': edit('fx_rates', add(
        'EUR,2026-07-09,1.100000', 'GBP,2026-07-09,1.250000', 'GBP,2026-07-09,1.260000', 'GBP,2026-07-10,1.250000',
        'CHF,2026-07-09,abc', 'CHF,2026-07-10,0', 'CAD,2026-07-09,1.000000', 'CAD,2026-07-10,1.050000',
        'JPY,2026-07-03,0.006400', 'JPY,2026-07-06,0.0067264', 'JPY,2026-07-08,0.006700',
        'NOK,2026-07-09,1.000000', 'NOK,2026-07-10,inf',                       # infinite rate: unusable
        'AUD,09/07/2026,1.000000', 'AUD,2026-07-10,1.080000')),                # previous day written DD/MM/YYYY
    'transactions': edit('transactions', add(
        trade('FXQ01', 'FXACC1', 'FXSEC3', 'BUY', '2026-06-22', '2026-06-24', '10', '', '50.00', 'BOOKED'),
        trade('FXQ02', 'FXACC1', 'FXSEC1', 'BUY', '2026-06-22', '2026-06-24', '10', '10.00', '100.01', 'BOOKED'),
        trade('FXQ03', 'FXACC1', 'FXSEC1', 'BUY', '2026-06-23', '2026-06-25', '10', '10.00', '100.02', 'BOOKED'),
        trade('FXQ04', 'FXACC1', 'FXSEC2', 'BUY', '2026-06-22', '2026-06-24', '-10', '10.00', '100.00', 'BOOKED'),
        trade('FXQ05', 'FXACC2', 'FXSEC1', 'BUY', '2026-06-19', '2026-06-23', '1', '20.00', '20.00', 'BOOKED'),
        trade('FXQ06', 'FXACC2', 'FXSEC1', 'BUY', '2026-06-19', '2026-06-24', '2', '20.00', '40.00', 'BOOKED'),
        trade('FXQ07', 'FXACC2', 'FXSEC1', 'BUY', '2026-06-19', '2026-06-24', '3', '20.00', '60.00', 'BOOKED', note=EXT),
        trade('FXQ08', 'FXACC2', 'FXSEC2', 'BUY', '2026-06-22', '24/06/2026', '4', '10.00', '40.00', 'BOOKED'),
        trade('FXQ09', 'FXACC2', 'FXSEC3', 'BUY', '2026-06-22', '2026-06-24', '15', '5.00', '75.00', 'BOOKED'),
        trade('FXQ10', 'FXACC2', 'FXSEC3', 'BUY', '2026-06-22', '2026-06-24', '15.0', '5.0', '75.00', 'BOOKED'),
        trade('FXQ11', 'FXACC1', 'FXSEC3', 'BUY', '2026-06-23', '2026-06-25', '7', '5.00', '35.00', 'CANCELLED'),
        trade('FXQ12', 'FXACC1', 'FXSEC3', 'BUY', '2026-06-23', '2026-06-25', '7', '5.00', '35.00', 'BOOKED', rel='FXQ11'),
        trade('FXQ13', 'FXACC1', 'FXSEC3', 'BUY', '2026-06-24', '2026-06-26', '8', '5.00', '40.00', 'CANCELLED'),
        trade('FXQ14', 'FXACC1', 'FXSEC3', 'BUY', '2026-06-24', '2026-06-26', '9', '5.00', '45.00', 'CANCELLED', rel='FXQ13'),
        trade('FXQ15', 'FXACC1', 'FXSEC3', 'BUY', '2026-06-24', '2026-06-26', '8', '5.00', '40.00', 'BOOKED', rel='FXQ14'),
        trade('FXQ16', 'FXACC2', 'FXSEC1', 'SELL', '2026-06-25', '2026-06-29', '1', '20.00', '20.00', 'REVERSED', rel='FXT01'),
        trade('FXQ17', 'FXACC3', 'FXSEC3', 'BUY', '2026-06-19', '2026-06-24', '6', '5.00', '30.00', 'BOOKED', note=EXT),
        trade('FXQ17', 'FXACC3', 'FXSEC3', 'BUY', '2026-06-19', '2026-06-24', '6', '5.00', '30.00', 'BOOKED'),
        trade('FXQ18', 'FXACC3', 'FXSEC3', 'SELL', '2026-06-25', '2026-06-29', '1', '5.00', '5.00', 'BOOKED', rel='FXQ18'),
        trade('FXQ19', 'FXACC3', 'FXSEC3', 'SELL', '2026-06-26', '2026-06-30', '2', '5.00', '10.00', 'BOOKED', rel='FXQ99'),
        trade('FXQ20', 'FXACC1', 'FXSEC3', 'BUY', '2026-06-26', '2026-06-30', '1', '5.00', '5.00', 'BOOKED'),
        trade('FXQ20', 'FXACC2', 'FXSEC3', 'BUY', '2026-06-26', '2026-06-30', '1', '', '5.00', 'BOOKED'),
        trade('FXQ21', 'FXACC1', 'FXSEC3', 'SELL', '2026-06-29', '2026-07-01', '1', '5.00', '5.00', 'BOOKED', rel='FXQ20'),
        trade('FXQ22', 'FXACC3', 'FXSEC3', 'SELL', '2026-06-30', '2026-07-02', '3', '5.00', '15.00', 'CANCELLED',
              rel='FXQ98'),
        trade('FXQ23', 'FXACC3', 'FXSEC3', 'BUY', '2026-06-30', '2026-07-02', '1', 'inf', 'inf', 'BOOKED'))),
}
edit('manifest', lambda rows, fields: [{**row, 'rows': str(counts.get(row['table'], row['rows']))} for row in rows])
PY
uv run --quiet python - <<'PY'
base = open('config/reconciliation.toml').read()
for old, new in [('reversed_main = "R1"', 'reversed_main = "R3"'), ('reversed_side = "R3"', 'reversed_side = "R1"')]:
    assert old in base, f'config has no line {old!r}'
    base = base.replace(old, new)
open('tests/runs/config_fixture_r3.toml', 'w').write(base)
PY
run() {  # $1 = label, $2 = config path or empty, $3 = notebook (default: the deliverable notebook)
  rm -rf "$W/run_fixture_$1"
  RECONCILIATION_OUTPUTS="$W/run_fixture_$1" RECONCILIATION_CONFIG="$2" tests/run_notebook.sh ${3:-} | tail -1
}
run default ""
run shuffled "$W/config_fixture_shuffled.toml"
run settlement "$W/config_fixture_settlement.toml"
run notrace "$W/config_fixture_notrace.toml"
RECONCILIATION_DATA="$W/fixture_edge/manifest.csv" run edge ""
RECONCILIATION_DATA="$W/fixture_r3/manifest.csv" run r3 "$W/config_fixture_r3.toml"
RECONCILIATION_DATA="$W/fixture_r3/manifest.csv" run r3default ""
RECONCILIATION_DATA="$W/fixture_quality/manifest.csv" run quality ""
RECONCILIATION_DATA="$W/fixture_quality/manifest.csv" run quality_lag3 "$W/config_fixture_lag3.toml"
uv run --quiet python - <<'PY'
import glob, os, pandas as pd
W = 'tests/runs'
read = lambda run, name: pd.read_csv(f'{W}/run_fixture_{run}/{name}', dtype=str, keep_default_na=False)
results = []
def expect(what, expected, observed):
    results.append((what, expected, observed, expected == observed))

# Fixture case -> expected outcome (default config: trade date, R1 main, R3 side view)
classes = read('default', '02_break_classes.csv').set_index('main_class')['keys'].astype(int)
expect('blank book quantity -> not evaluable, never a break',
       1, int(classes.get('not evaluable: unreadable book quantity', 0)))
expect('blank trade date in the main chain -> not evaluable', 1, int(classes.get('not evaluable: unreadable date', 0)))
expect('custodian on settlement-date basis -> its cause class', 1,
       int(classes.get('custodian is the odd one out: custodian on settlement-date basis', 0)))
side = read('default', '02_reversed_side_view.csv')
side.columns = ['main', 'side', 'keys']
agree = side[(side['main'] == 'rebuild is the odd one out') & (side['side'] == 'all three agree')]['keys'].astype(int).sum()
expect('two reversals per original, in both file orders -> R3 offsets with the lowest ID, so both keys agree under R3',
       2, int(agree))
ca = read('default', '02_ca_readiness.csv').set_index('action_type')
expect('blank trade date before the ex-date -> holder key not evaluable (split)',
       ('1', '1'), (ca.loc['SPLIT', 'candidate holders'], ca.loc['SPLIT', 'holder keys not evaluable']))
register = read('default', '02_defect_register.csv').set_index('finding')
expect('EUR price on a date with no EUR rate (EUR rate dated DD/MM/YYYY on the other date) -> 2 rows',
       '2', register.loc['Price with no FX rate for its currency on the price date', 'affected'])
expect('blank price from the preferred vendor -> preferred vendor has no valid price (1 security-date)',
       '1', register.loc['Preferred vendor has no valid price on a date', 'affected'])
breaks = (read('default', '02_break_classes.csv').query("`is a break` == 'yes'")['keys'].astype(int).sum())
class_lines = register[register['rule'].str.startswith('POS_') & register['how detected'].str.contains('section 5')]
expect('break keys = sum of the break-class register lines', int(breaks), int(class_lines['affected'].astype(int).sum()))
trace = read('default', '02_trace.csv')
traced = trace[(trace['hop'] == 'source') & (trace['field'] == 'quantity')]['value'].tolist()
expect('trace picks the negative-quantity BUY present in all three sources', ['-50'], traced)
gross_note = trace.loc[trace['field'] == 'gross_amount / price', 'note'].str.cat()
expect('gross_amount fits the size -> trace says it confirms the size and states both readings', True,
       'confirms the size' in gross_note and 'wrong sign' in gross_note and 'wrong type' in gross_note)

# Shuffled rows -> the same outputs (the conflicting-pair keep_first / keep_second lines aside: none in the fixture)
changed = []
for path in sorted(glob.glob(f'{W}/run_fixture_default/02_*.csv')):
    name = os.path.basename(path)
    if name in ('02_run_info.csv', '02_row_ledger.csv'):
        continue
    a, b = read('default', name), read('shuffled', name)
    a, b = (f.sort_values(list(f.columns)).reset_index(drop=True) for f in (a, b))
    if not a.equals(b):
        changed.append(name)
expect('rows shuffled (seed 3) -> same outputs', [], changed)

# holding_date = settlement -> the run finishes and C7 is the settlement-date version
waterfall = read('settlement', '02_waterfall.csv')
expect('settlement run: C7 line is the settlement-date cut-off', True,
       bool(waterfall.loc[waterfall['code'] == 'C7', 'variant'].str.startswith('settlement').all()))
expect('settlement run: the other line is the trade-date one (C7t)', True, bool((waterfall['code'] == 'C7t').any()))
ca_s = read('settlement', '02_ca_readiness.csv').set_index('action_type')
expect('settlement run: holders still use the trade-date rebuild', ('1', '1'),
       (ca_s.loc['SPLIT', 'candidate holders'], ca_s.loc['SPLIT', 'holder keys not evaluable']))

# No key carries the trace flag -> the run finishes and writes an empty trace
expect('no trace candidate -> empty 02_trace.csv, no crash', 0, len(read('notrace', '02_trace.csv')))

# Edge fixture (built above): cases a schema-compatible file may hold.
trace = read('edge', '02_trace.csv')
value = lambda field: trace.loc[trace['field'] == field, 'value'].tolist()
expect('edge: traced key on an account missing from accounts, no pipeline record -> trace written', ['FXT30'],
       trace.loc[(trace['hop'] == 'source') & (trace['field'] == 'transaction_id'), 'value'].tolist())
expect('edge: trace says the account is not in accounts', True,
       bool(((trace['table'] == 'accounts') & (trace['value'] == 'not in accounts')).any()))
expect('edge: trace counts 0 pipeline records', ['0'], value('pipeline records for this transaction_id'))
expect('edge: gross_amount fits neither sign -> trace does not say gross_amount confirms the size', False,
       bool(trace.loc[trace['field'] == 'gross_amount / price', 'note'].str.contains('confirms the size').any()))
expect('edge: USD-quoted security -> no FX rate applied (20 units x 5.00)', ['100.0'], value('indicative exposure (USD)'))
register = read('edge', '02_defect_register.csv').set_index('finding')
line = lambda name, column: register[column].get(name)
expect('edge: negative quantities -> the register states how many fit gross_amount', True,
       'gross_amount fits the absolute value on 1 of 2' in str(line('Negative trade quantity', 'how detected')))
expect('edge: a REVERSED row delivered twice, and unlinked REVERSED rows -> not "more than one per original"', '4',
       line('More than one REVERSED row per original', 'affected'))
summary = read('edge', '02_three_way_summary.csv')
bvc = summary[summary['comparison'] == 'book vs custodian'].set_index('group or pattern')['keys']
expect('edge: book row dated DD/MM/YYYY -> still matched with the custodian', '0', bvc.get('only in positions'))
waterfall = read('edge', '02_waterfall.csv')
expect('edge: book row dated DD/MM/YYYY -> still matched with the rebuild', ['0'],
       waterfall.loc[(waterfall['code'] == 'C7') & (waterfall['compared with'] == 'positions'), 'only in reported table'].tolist())
nav = read('edge', '02_nav_check.csv').set_index('ledger_id')
expect('edge: same fund + class + date in two formats -> both rows repeated', ['FXL1', 'FXL3'],
       sorted(nav.index[nav['repeated key'] == 'True']))
expect('edge: unreadable as_of_date -> not evaluable', 'not evaluable', nav.loc['FXL4', 'result'])
vendor = read('edge', '02_vendor_check.csv').set_index('security_id')
expect('edge: two quotes from one vendor -> not evaluable, not a spread', True,
       'not evaluable' in vendor.loc['FXSEC1', 'result'])
expect('edge: the custodian reports a zero row -> closed positions not cleared', 'unresolved',
       line('Closed position not reported (trades net to zero, absent from book and custodian)', 'status'))
blank = read('edge', '02_blank_quantity.csv').set_index('measure')['count']
expect('edge: blank quantity with gross_amount / price = 10 units -> derivable; a linked blank -> held', ('1', '1'),
       (blank['derivable: whole number of units, no link to another trade'], blank['held: linked to another trade']))
expect('edge: book holds the key without the derived units -> "book leaves out the units"', ('1', 'FXACC1/FXSEC3'),
       (line('Book leaves out the units of trades with a blank quantity', 'affected'),
        line('Book leaves out the units of trades with a blank quantity', 'examples')))
ledger = read('edge', '02_row_ledger.csv').set_index('step')
set_aside = lambda step: int(ledger.loc[step, 'rows in']) - int(ledger.loc[step, 'rows out'])
expect('edge: book and custodian rows on another day, and a book row with an unreadable date -> set aside, counted',
       (1, 1, 1, 0), (set_aside('positions: rows dated another day set aside'),
                       set_aside('positions: rows with an unreadable as_of_date set aside'),
                       set_aside('comparison_positions: rows dated another day set aside'),
                       set_aside('comparison_positions: rows with an unreadable as_of_date set aside')))
rebook = 'Rebook changes the quantity but keeps the cancelled gross_amount'
expect('edge: rebook of a CANCELLED trade delivered with two quantities -> not evaluable, never flagged',
       (False, '1'), ('FXT61' in str(line(rebook, 'examples')), line(rebook, 'not evaluable')))
usd = 'USD rate to USD is not 1'
expect('edge: a USD rate that does not parse -> not evaluable, not "not 1"', ('1', '1'),
       (line(usd, 'affected'), line(usd, 'not evaluable')))
patterns = [*read('edge', '02_break_classes.csv')['pattern'], *read('r3', '02_break_classes.csv')['pattern'],
            *read('edge', '02_reversed_side_view.csv').iloc[:, :2].stack(), *read('r3', '02_reversed_side_view.csv').iloc[:, :2].stack(),
            *read('r3default', '02_reversed_side_view.csv').iloc[:, :2].stack()]
expect('edge and R3 runs: every not-evaluable key names its cause (no "not evaluable: other")', [],
       sorted({p for p in patterns if 'other' in p}))
expect('R3 main reading: an orphan REVERSED row on a clean key -> named as its cause', True,
       'not evaluable: REVERSED row with nothing to offset' in set(read('r3', '02_break_classes.csv')['pattern']))
side_view = read('r3default', '02_reversed_side_view.csv')
expect('R3 side view: a REVERSED row with a blank quantity on a clean key -> "blank quantity", from the side chain', True,
       'not evaluable: blank quantity' in set(side_view.iloc[:, 1]))
rebook_population = lambda run: read(run, '02_defect_register.csv').set_index('finding').loc[rebook, 'population']
expect('a CANCELLED row with a blank transaction_id -> no unlinked trade becomes its rebook',
       rebook_population('edge'), rebook_population('r3default'))
trace_r3 = read('r3', '02_trace.csv')
expect('R3 trace on a negative REVERSED row -> wrong-sign value uses what the chain used (+10 offset): 0 - 2 x 10',
       (['FXT29'], ['-20.0']),
       (trace_r3.loc[(trace_r3['hop'] == 'source') & (trace_r3['field'] == 'transaction_id'), 'value'].tolist(),
        trace_r3.loc[trace_r3['field'] == 'quantity under the wrong-sign reading', 'value'].tolist()))
impact = read('r3', '02_impact_detail.csv')
reversed_negative = impact[(impact['account_id'] == 'FXACC9') & impact['scenario'].str.contains('wrong-sign')]
expect('R3 run, severity section: a negative BUY and its negative reversal -> wrong-sign scenario moves 0 units', [0.0],
       reversed_negative['delta_units'].astype(float).tolist())
import json, re
cells = json.load(open('notebooks/deliverable.ipynb'))['cells']
pattern = re.search(r"re\.findall\(r'(.+?)', source_text\)", ''.join(''.join(c['source']) for c in cells)).group(1)
expect('literal-ID self-check covers every ID prefix in the release', [],
       [i for i in ['ACC1000001', 'SEC100001', 'TXN100000001', 'CA00001', 'FND00001', 'LDG000001', 'POS000000001',
                    'CMP000000001'] if not re.fullmatch(pattern, i)])
copies = read('default', '02_duplicate_profile.csv').set_index('measure')
expect('fixture book counts the copied SELL once -> profile says transaction_count counts each copy once',
       ('0', 'counts each copy once: 1'),
       (copies.loc['of the book positions holding a copy: transaction_count counts both copies', 'count'],
        copies.loc['of the book positions holding a copy: transaction_count counts both copies', 'note']))

# Timeliness (section 9b, D-065): one row per measure x feed x day, plus feed and platform totals.
COUNTS = ['population', 'eligible', 'pass', 'fail', 'not_evaluable_missing', 'not_evaluable_unparseable',
          'not_evaluable_out_of_order']
def timeliness(run):
    return read(run, '02_timeliness.csv').set_index(['measure', 'source_system', 'day'])
def fields(table, row, *names):
    return tuple(table.loc[row, name] for name in names)
tl = timeliness('default')
expect('timeliness default: booking cutoff, the 3 booked before their event are out of order',
       ('17', '14', '14', '0', '3'), fields(tl, ('booking_cutoff', 'all', 'all'), 'population', 'eligible', 'pass', 'fail',
                                            'not_evaluable_out_of_order'))
expect('timeliness default: published 19:00 after the 18:00 cutoff -> late; FXT06 and FXT11 at 17:00 on time', ('15', '2'),
       fields(tl, ('publication_cutoff', 'all', 'all'), 'fail', 'pass'))
expect('timeliness default: event after received -> 3 out of order', ('3', '17'),
       fields(tl, ('timestamp_order', 'all', 'all'), 'fail', 'eligible'))
expect('timeliness default: feed latency on 14, the 3 out of order not evaluable', ('14', '3', '5.0'),
       fields(tl, ('feed_latency', 'all', 'all'), 'eligible', 'not_evaluable_out_of_order', 'median_minutes'))
expect('timeliness default: processing latency on all 17', ('17', '5.0'),
       fields(tl, ('processing_latency', 'all', 'all'), 'eligible', 'median_minutes'))
latency_days = tl[tl.index.get_level_values('measure').isin(['feed_latency', 'processing_latency'])
                  & (tl.index.get_level_values('day') != 'all')]
expect('timeliness default: a feed with no configured limit -> "no limit for this feed" on every latency day row',
       {'no limit for this feed'}, set(latency_days['median_above_limit']))
te = timeliness('edge')
expect('timeliness edge: feed-latency median 60 = limit -> not above it', ('60.0', '60.0', 'no'),
       fields(te, ('feed_latency', 'OMS_FRONT', '2026-06-02'), 'median_minutes', 'limit_minutes', 'median_above_limit'))
expect('timeliness edge: feed-latency median 61 -> above the limit', 'yes',
       te.loc[('feed_latency', 'OMS_FRONT', '2026-06-03'), 'median_above_limit'])
expect('timeliness edge: processing median 241 -> above the limit', ('241.0', 'yes'),
       fields(te, ('processing_latency', 'OMS_FRONT', '2026-06-04'), 'median_minutes', 'median_above_limit'))
expect('timeliness edge: event written DD/MM/YYYY -> parsed and measured', '1',
       te.loc[('feed_latency', 'FIXTURE_OMS', '2026-06-05'), 'eligible'])
expect('timeliness edge: blank received -> latency missing, booking cutoff still judged', ('1', '1'),
       (te.loc[('feed_latency', 'FIXTURE_OMS', '2026-06-08'), 'not_evaluable_missing'],
        te.loc[('booking_cutoff', 'FIXTURE_OMS', '2026-06-08'), 'pass']))
expect('timeliness edge: unreadable booked -> unparseable for processing and booking cutoff', ('1', '1'),
       (te.loc[('processing_latency', 'FIXTURE_OMS', '2026-06-09'), 'not_evaluable_unparseable'],
        te.loc[('booking_cutoff', 'FIXTURE_OMS', '2026-06-09'), 'not_evaluable_unparseable']))
expect('timeliness edge: received written with a T -> unparseable, never dropped', '1',
       te.loc[('feed_latency', 'FIXTURE_OMS', '2026-06-10'), 'not_evaluable_unparseable'])
expect('timeliness edge: booked exactly at the cutoff -> on time', ('1', '0'),
       fields(te, ('booking_cutoff', 'FIXTURE_OMS', '2026-07-09'), 'pass', 'fail'))
expect('timeliness edge: booked 18:01 -> late; the other record that day on time', ('1', '1'),
       fields(te, ('booking_cutoff', 'FIXTURE_OMS', '2026-06-12'), 'pass', 'fail'))
expect('timeliness edge: published before booked -> out of order for publication, not a pass', ('1', '1'),
       fields(te, ('publication_cutoff', 'FIXTURE_OMS', '2026-06-12'), 'fail', 'not_evaluable_out_of_order'))
expect('timeliness edge: published 17:59 -> on time', '1', te.loc[('publication_cutoff', 'OMS_FRONT', '2026-06-02'), 'pass'])
expect('timeliness edge: copies published 17:00 and 19:00 -> counted once, late (the later time)', ('2', '0', '1', '1'),
       fields(te, ('publication_cutoff', 'FIXTURE_OMS', '2026-06-10'), 'fail', 'pass', 'repeated_ids', 'copies_disagree'))
expect('timeliness edge: blank cutoff -> day from the event, cutoff missing', ('2', '1', '3'),
       fields(te, ('booking_cutoff', 'FIXTURE_OMS', '2026-06-11'), 'eligible', 'not_evaluable_missing',
              'not_evaluable_out_of_order'))
expect('timeliness edge: trades with no pipeline record -> on their feed-day, missing', ('2', '2'),
       fields(te, ('booking_cutoff', 'FIXTURE_OMS', '2026-06-15'), 'population', 'not_evaluable_missing'))
expect('timeliness edge: one copy of a repeated ID books before receipt -> order fails, booking cutoff and processing not judged',
       ('1', '1', '1', '1'), (te.loc[('timestamp_order', 'FIXTURE_OMS', '2026-06-10'), 'fail'],
                              te.loc[('booking_cutoff', 'FIXTURE_OMS', '2026-06-10'), 'pass'],
                              te.loc[('booking_cutoff', 'FIXTURE_OMS', '2026-06-10'), 'not_evaluable_out_of_order'],
                              te.loc[('processing_latency', 'FIXTURE_OMS', '2026-06-10'), 'not_evaluable_out_of_order']))
expect('timeliness edge: copies 5/55 and 55/5 minutes -> each latency is the longest per copy, never the flattering mix',
       ('55.0', '55.0'), (te.loc[('feed_latency', 'FIXTURE_OMS', '2026-06-16'), 'median_minutes'],
                          te.loc[('processing_latency', 'FIXTURE_OMS', '2026-06-16'), 'median_minutes']))
expect('timeliness edge: one copy without received, the other with it -> missing', '1',
       te.loc[('feed_latency', 'FIXTURE_OMS', '2026-06-17'), 'not_evaluable_missing'])
expect('timeliness edge: blank received and unreadable booked -> processing missing, not unparseable; booking cutoff unparseable',
       ('1', '0', '1'), (te.loc[('processing_latency', 'OMS_FRONT', '2026-06-18'), 'not_evaluable_missing'],
                         te.loc[('processing_latency', 'OMS_FRONT', '2026-06-18'), 'not_evaluable_unparseable'],
                         te.loc[('booking_cutoff', 'OMS_FRONT', '2026-06-18'), 'not_evaluable_unparseable']))
expect('timeliness edge: a feed-day with a limit but no eligible record -> "no eligible record"', 'no eligible record',
       te.loc[('processing_latency', 'OMS_FRONT', '2026-06-18'), 'median_above_limit'])
expect('timeliness edge: processing median exactly 240 = limit -> not above it', ('240.0', 'no'),
       fields(te, ('processing_latency', 'OMS_FRONT', '2026-06-19'), 'median_minutes', 'median_above_limit'))
expect('timeliness edge: no readable date -> day "unknown", never judged against a daily limit', 'no day',
       te.loc[('processing_latency', 'OMS_FRONT', 'unknown'), 'median_above_limit'])
expect('timeliness edge: blank cutoff -> publication cutoff missing too', '1',
       te.loc[('publication_cutoff', 'FIXTURE_OMS', '2026-06-11'), 'not_evaluable_missing'])
expect('timeliness edge: no pipeline record -> missing on every measure (FXT30 and FXT40)', ['2'] * 5,
       [te.loc[(m, 'FIXTURE_OMS', '2026-06-15'), 'not_evaluable_missing'] for m in
        ['feed_latency', 'processing_latency', 'booking_cutoff', 'publication_cutoff', 'timestamp_order']])
expect('timeliness edge: published before booked -> order fails', '1',
       te.loc[('timestamp_order', 'FIXTURE_OMS', '2026-06-12'), 'fail'])
for run in ['default', 'edge']:
    frame = read(run, '02_timeliness.csv')
    num = {c: pd.to_numeric(frame[c], errors='coerce').fillna(0).astype(int) for c in COUNTS}
    adds_up = (num['eligible'] + num['not_evaluable_missing'] + num['not_evaluable_unparseable']
               + num['not_evaluable_out_of_order'] == num['population'])
    judged = ~frame['measure'].isin(['feed_latency', 'processing_latency'])
    passes = (num['pass'] + num['fail'] == num['eligible']) | ~judged
    expect(f'timeliness {run}: eligible + not evaluable = population on every row', True, bool(adds_up.all()))
    expect(f'timeliness {run}: pass + fail = eligible on cutoff and order rows', True, bool(passes.all()))
    counts = frame.assign(**num)
    days = counts[(counts['source_system'] != 'all') & (counts['day'] != 'all')].groupby(['measure', 'source_system'])[COUNTS].sum()
    feeds = counts[(counts['source_system'] != 'all') & (counts['day'] == 'all')].set_index(['measure', 'source_system'])[COUNTS]
    platform = counts[counts['source_system'] == 'all'].set_index('measure')[COUNTS]
    expect(f'timeliness {run}: each feed total = the sum of its days', True, days.sort_index().equals(feeds.sort_index()))
    expect(f'timeliness {run}: platform = the sum of the feeds', True,
           feeds.groupby('measure').sum().sort_index().equals(platform.sort_index()))

# Timeliness register lines (section 10): appended after every existing line, members written.
TIMELINESS_LINES = ['Pipeline timestamp missing', 'Pipeline timestamp unparseable', 'Pipeline timestamps out of order',
                    "Feed latency: daily median above the feed's limit",
                    "Processing latency: daily median above the feed's limit", 'Booked after cutoff', 'Published after cutoff']
members = read('edge', '02_finding_members.csv').groupby('finding')['record_id'].apply(set)
member = lambda name: members.get(name, set())
expect('timeliness register edge: missing holds blank received, blank cutoff and no pipeline record, not unparseable',
       (True, False), ({'FXT06', 'FXT10', 'FXT30', 'FXT33', 'FXT34', 'FXT90'} <= member('Pipeline timestamp missing'),
                       'FXT08' in member('Pipeline timestamp missing')))
expect('timeliness register edge: unparseable = the T-written received and the unreadable booked times', {'FXT07', 'FXT08', 'FXT34'},
       member('Pipeline timestamp unparseable'))
expect('timeliness register edge: out of order = event after received, published before booked, and one copy booked before receipt',
       {'FXT02', 'FXT12', 'FXT21', 'FXT22', 'FXT23'}, member('Pipeline timestamps out of order'))
expect('timeliness register edge: booked after cutoff = the 18:01 booking only', {'FXT13'}, member('Booked after cutoff'))
expect('timeliness register edge: published after cutoff holds the later copy and the 19:00 publish, not 17:59 or out of order',
       (True, False, False), ({'FXT02', 'FXT13'} <= member('Published after cutoff'),
                              'FXT01' in member('Published after cutoff'), 'FXT23' in member('Published after cutoff')))
expect('timeliness register edge: feed-latency median above limit = one feed-day', {'OMS_FRONT 2026-06-03'},
       member("Feed latency: daily median above the feed's limit"))
expect('timeliness register edge: processing median above limit = one feed-day', {'OMS_FRONT 2026-06-04'},
       member("Processing latency: daily median above the feed's limit"))
NAV_LINE = 'NAV arithmetic does not hold (net_assets / shares_outstanding vs nav_per_share)'
for run in ['default', 'edge']:
    register = read(run, '02_defect_register.csv')
    names = register['finding'].tolist(); i = names.index(NAV_LINE)
    expect(f'timeliness register {run}: the seven lines follow the NAV line, in order', TIMELINESS_LINES,
           names[i + 1:i + 8])
    lines = register.set_index('finding')
    expect(f'timeliness register {run}: latency lines unresolved, the rest confirmed',
           ['confirmed'] * 3 + ['unresolved'] * 2 + ['confirmed'] * 2, [lines.loc[n, 'status'] for n in TIMELINESS_LINES])
lines = read('default', '02_defect_register.csv').set_index('finding')
expect('timeliness register default: nothing unparseable; no limit for FIXTURE_OMS -> no feed-day evaluable',
       ('0', '0', '0', '0', '0'),
       (lines.loc['Pipeline timestamp unparseable', 'affected'],
        *[lines.loc[n, c] for n in TIMELINESS_LINES[3:5] for c in ('affected', 'eligible')]))

# Price data quality (section 8b, quality-checks spec §6.2-§6.4): coverage, fallback-only, freshness, flat runs.
QUALITY_LINES = ['Holding with no eligible quote on the snapshot date',
                 'Holding priced only by a fallback vendor on the snapshot date',
                 'Chosen quote stamped after the NAV cutoff',
                 'Scale flag: the chosen quote is the odd one out',
                 'Scale flag: the chosen quote is backed by another vendor',
                 'Spread flag: the chosen quote is the odd one out',
                 'Spread flag: the chosen quote is backed by another vendor',
                 'Spread or scale flag: no two vendors agree',
                 'FX rate repeated for a currency and date',
                 'FX rate not positive or unreadable',
                 'FX rate moves more than the band from the previous business day',
                 'Blank or unreadable trade price',
                 'gross_amount does not equal quantity x price',
                 'Settlement later than the lag limit with no agreed extension',
                 'Settlement later than the lag limit with an agreed extension',
                 'Same economics under a different transaction_id',
                 'Correction link points to itself, to a missing ID, or to another account or security']   # spec order
def line_counts(run, name):
    row = read(run, '02_defect_register.csv').set_index('finding').loc[name]
    return tuple(row[c] for c in ('affected', 'eligible', 'not evaluable', 'population'))
for run in ['default', 'quality']:
    names = read(run, '02_defect_register.csv')['finding'].tolist()
    expect(f'quality {run}: new lines follow the timeliness lines, in order', QUALITY_LINES,
           names[names.index('Published after cutoff') + 1:][:len(QUALITY_LINES)])
expect('quality default: every holding covered by the priority vendor, every chosen quote fresh',
       [('0', '7', '0', '7'), ('0', '7', '0', '7'), ('0', '3', '0', '3')],
       [line_counts('default', n) for n in QUALITY_LINES[:3]])
pq = read('default', '02_price_quality.csv').set_index('security_id')
expect('quality default: FXSEC1 chosen V1 20.0, fresh, run 1 (its 07-09 V1 price is blank)',
       ('FIXTURE_V1', '20.0', 'pass', 'pass', '1'),
       tuple(pq.loc['FXSEC1', c] for c in ['chosen_vendor', 'chosen_price', 'coverage', 'freshness', 'flat_run_dates']))
expect('quality: coverage fail = no snapshot quote and quotes only in another currency (2 rows); not evaluable = '
       'unmastered, unreadable price_date, an infinite price and a blank master currency', ('2', '23', '4', '27'),
       line_counts('quality', QUALITY_LINES[0]))
members = read('quality', '02_finding_members.csv').groupby('finding')['record_id'].apply(set)
expect('quality: coverage fail members', {'FXSEC4', 'FXSEC17'}, members[QUALITY_LINES[0]])
expect('quality: fallback-only = FXSEC5; population = coverage passes only', ('1', '21', '0', '21'),
       line_counts('quality', QUALITY_LINES[1]))
expect('quality: stale = 18:01 and next-day stamps; 18:00 on time; blank stamp not evaluable', ('2', '16', '1', '17'),
       line_counts('quality', QUALITY_LINES[2]))
expect('quality: stale members', {'FXSEC7', 'FXSEC8'}, members[QUALITY_LINES[2]])
pq = read('quality', '02_price_quality.csv').set_index('security_id')
col = lambda c: {s: pq.loc[s, c] for s in pq.index}
expect('quality: fresh fallback yes for FXSEC7 (V2 at 17:00), no for FXSEC8 (V2 also next day)', ('yes', 'no'),
       (pq.loc['FXSEC7', 'fresh_fallback'], pq.loc['FXSEC8', 'fresh_fallback']))
expect('quality: freshness reasons', ('after the NAV cutoff', 'stamped on another day', 'timestamp missing'),
       tuple(pq.loc[s, 'freshness_reason'] for s in ['FXSEC7', 'FXSEC8', 'FXSEC9']))
expect('quality: flat run 6 across a weekend; a missing date breaks the run (2)', ('6', '2'),
       (pq.loc['FXSEC10', 'flat_run_dates'], pq.loc['FXSEC11', 'flat_run_dates']))
expect('quality: coverage results of the special cases',
       {'FXSEC4': 'fail', 'FXSEC5': 'pass', 'FXSEC17': 'fail', 'FXSEC18': 'not evaluable', 'FXSEC19': 'not evaluable',
        'FXSEC22': 'not evaluable', 'FXSEC90': 'not evaluable'},
       {s: col('coverage')[s] for s in ['FXSEC4', 'FXSEC5', 'FXSEC17', 'FXSEC18', 'FXSEC19', 'FXSEC22', 'FXSEC90']})
expect('quality: an infinite price and a blank currency give no chosen quote', ('', ''),
       (pq.loc['FXSEC19', 'chosen_vendor'], pq.loc['FXSEC22', 'chosen_vendor']))
edge_pq = read('edge', '02_price_quality.csv').set_index('security_id')
expect('edge: two V1 quotes on the snapshot -> chosen is the lower-sorting one, whatever the row order', '20.0',
       edge_pq.loc['FXSEC1', 'chosen_price'])
for run in ['default', 'quality']:
    pq = read(run, '02_price_quality.csv')
    held = pq[pq['coverage'] != 'not held on the snapshot']
    expect(f'quality {run}: coverage pass + fail + not evaluable rows = positions rows on the snapshot',
           line_counts(run, QUALITY_LINES[0])[3], str(held['snapshot_position_rows'].astype(int).sum()))

# Inside the spread and scale flags (section 8b, quality-checks spec §6.5): register lines 4-8.
LOOK = QUALITY_LINES[3:8]
expect('quality default: no flags -> five zero lines', [('0', '0', '0', '0')] * 5, [line_counts('default', n) for n in LOOK])
expect('quality: lines 4-8 counts',
       [('1', '2', '0', '2'), ('1', '2', '0', '2'), ('2', '5', '1', '6'), ('2', '5', '1', '6'), ('1', '7', '1', '8')],
       [line_counts('quality', n) for n in LOOK])
expect('quality: lines 4-8 members',
       [{'FXSEC12'}, {'FXSEC13'}, {'FXSEC14', 'FXSEC21'}, {'FXSEC15', 'FXSEC20'}, {'FXSEC16'}],
       [members[n] for n in LOOK])
pq = read('quality', '02_price_quality.csv').set_index('security_id')
# Odd vendor: backed -> never the chosen vendor, the farthest of those that disagree with it (FXSEC20: V1 and V3 tie
# on the median distance, V1 is chosen, V3 is odd); chosen is odd -> the chosen vendor (FXSEC21: V4 is farther from
# the median, but V1 is the odd one out); otherwise the farthest from the median, ties by vendor name.
expect('quality: classes and odd vendors',
       [('chosen is odd', 'FIXTURE_V1'), ('backed', 'FIXTURE_V3'), ('chosen is odd', 'FIXTURE_V1'),
        ('backed', 'FIXTURE_V3'), ('no two agree', 'FIXTURE_V1'), ('not evaluable: no chosen quote', 'FIXTURE_V1'),
        ('backed', 'FIXTURE_V3'), ('chosen is odd', 'FIXTURE_V1')],
       [(pq.loc[s, 'flag_class'], pq.loc[s, 'odd_vendor']) for s in
        ['FXSEC12', 'FXSEC13', 'FXSEC14', 'FXSEC15', 'FXSEC16', 'FXSEC17', 'FXSEC20', 'FXSEC21']])
# Spec §7 identity, from the register itself: per flag, affected(odd) + affected(backed) + that flag's members of
# "no two agree" + not evaluable = section 8's count of the flag (02_vendor_check.csv).
for run in ['default', 'quality']:
    section8 = read(run, '02_vendor_check.csv').set_index('security_id')['result']
    no_two_agree = read(run, '02_finding_members.csv').query('finding == @LOOK[4]')['record_id']
    for flag, kind, odd_line, backed_line in [('scale flag (ratio near 100)', 'scale', LOOK[0], LOOK[1]),
                                              ('spread above threshold', 'spread', LOOK[2], LOOK[3])]:
        odd, backed = line_counts(run, odd_line), line_counts(run, backed_line)
        expect(f'quality {run}: {kind} lines: affected + no two agree + not evaluable = section 8 {kind} flags',
               int((section8 == flag).sum()),
               int(odd[0]) + int(backed[0]) + int((section8[no_two_agree] == flag).sum()) + int(odd[2]))
pq = read('quality', '02_price_quality.csv').set_index('security_id')
expect('quality: dates flagged on the snapshot only (one date of quotes)', '1', pq.loc['FXSEC12', 'dates_scale_flagged'])
expect('quality: dates counted across dates; the scale date (07-09) is not also a spread date; 07-07 not flagged',
       ('2', '1'), (pq.loc['FXSEC14', 'dates_spread_flagged'], pq.loc['FXSEC14', 'dates_scale_flagged']))
expect('quality: FXSEC14 earlier dates leave its snapshot results alone (chosen V1 10.2, run 1, chosen is odd)',
       ('FIXTURE_V1', '10.2', 'pass', 'pass', '1', 'chosen is odd'),
       tuple(pq.loc['FXSEC14', c] for c in ['chosen_vendor', 'chosen_price', 'coverage', 'freshness', 'flat_run_dates',
                                            'flag_class']))

# FX rates (section 9c, quality-checks spec §6.6): register lines 9-11.
FX = QUALITY_LINES[8:11]
expect('quality default FX: nothing repeated or unusable; band judges USD 07-10 only',
       [('0', '3', '0', '3'), ('0', '3', '0', '3'), ('0', '1', '2', '3')], [line_counts('default', n) for n in FX])
expect('quality FX: repeated GBP pair; CHF 0 and abc, NOK inf; JPY +5.1% Friday to Monday and AUD +8% from a '
       'DD/MM/YYYY date (CAD exactly 5% passes)',
       [('2', '18', '0', '18'), ('3', '18', '0', '18'), ('2', '5', '13', '18')], [line_counts('quality', n) for n in FX])
expect('quality FX members', [{'GBP'}, {'CHF', 'NOK'}, {'JPY', 'AUD'}], [members[n] for n in FX])

# Trade field checks (section 9c, quality-checks spec §6.7): register lines 12-15.
TRADE = QUALITY_LINES[11:15]
expect('quality default trades: all priced, all amounts fit, every lag T+2; FXT07 has no trade date',
       [('0', '18', '0', '18'), ('0', '18', '0', '18'), ('0', '17', '1', '18'), ('0', '17', '1', '18')],
       [line_counts('default', n) for n in TRADE])
expect('quality trades: blank and infinite price; 0.02 off (0.01 passes; inf x inf not evaluable); T+3 without and '
       'with the note; FXQ17 and FXQ20 copies disagree',
       [('2', '41', '2', '43'), ('1', '39', '4', '43'), ('1', '40', '3', '43'), ('1', '40', '3', '43')],
       [line_counts('quality', n) for n in TRADE])
expect('quality trade members', [{'FXQ01', 'FXQ23'}, {'FXQ03'}, {'FXQ06'}, {'FXQ07'}], [members[n] for n in TRADE])
expect('quality: FXQ17 on neither lag line', False,
       any('FXQ17' in members.get(n, set()) for n in TRADE[2:]))
lag3 = read('quality_lag3', '02_defect_register.csv').set_index('finding')
# FXQ06 and FXQ07 (lag 3) pass; FXQ17's copies (lag 3) both pass too, so they agree and are judged: 43 - FXT07 = 42.
expect('quality_lag3: the lag lines keep their names; FXQ06, FXQ07 and both FXQ17 copies now pass',
       (('0', '42'), ('0', '42')), tuple((lag3.loc[n, 'affected'], lag3.loc[n, 'eligible']) for n in TRADE[2:]))
expect('quality_lag3: the how-detected text states the live limit, T+3', (True, True),
       tuple('T+3' in lag3.loc[n, 'how detected'] for n in TRADE[2:]))
base = read('quality', '02_defect_register.csv').set_index('finding')
expect('quality_lag3: every other register line unchanged', True,
       base.drop(index=TRADE[2:]).equals(lag3.drop(index=TRADE[2:])))

# Economic duplicates and correction links (section 9c, quality-checks spec §6.7): register lines 16-17.
DUP, LINK = QUALITY_LINES[15], QUALITY_LINES[16]
expect('quality default: linked reversals of FXT10 and FXT20 are one family -> no economic duplicate',
       ('0', '16', '1', '17'), line_counts('default', DUP))
expect('quality default: four links, all same account and security', ('0', '4', '0', '4'), line_counts('default', LINK))
expect('quality: FXQ09/FXQ10 match (15 vs 15.0, 5.00 vs 5.0); FXQ11/12 linked and FXQ13/15 chained are not; '
       'FXT07, FXQ01 and FXQ23 (inf price) not evaluable', ('2', '37', '3', '40'), line_counts('quality', DUP))
expect('quality: economic duplicate members', {'FXQ09', 'FXQ10'}, members[DUP])
expect('quality: link to another account (FXQ16), self-link (FXQ18) and a BOOKED link to a missing ID (FXQ19) fail; '
       'a CANCELLED link to a missing ID (FXQ22, its own line) and a target whose copies disagree on the account '
       '(FXQ21) are not evaluable', ('3', '10', '2', '12'), line_counts('quality', LINK))
expect('quality: correction-link members', {'FXQ16', 'FXQ18', 'FXQ19'}, members[LINK])
r3_members = read('r3', '02_finding_members.csv').groupby('finding')['record_id'].apply(set)
expect('r3: a REVERSED row linked to a missing ID (FXT58) fails the correction-link line', True,
       'FXT58' in r3_members[LINK])

quality_how = read('quality', '02_defect_register.csv').set_index('finding')['how detected']
expect('quality: the cleared lag line says the evidence is the note in the same row and what would reopen it',
       (True, True), tuple(w in quality_how[TRADE[3]] for w in ('same row', 'reopen')))
expect('quality: economic duplicate text counts the groups sharing one event minute and one feed', True,
       '1 of 1 groups share one event minute and one feed' in quality_how[DUP])
expect('quality: price text counts blank on the failing row only, the disagreeing copy apart', True,
       '1 blank, 1 unreadable (1 more on copies that disagree, not evaluable)' in quality_how[TRADE[0]])

width = max(len(r[0]) for r in results)
for what, expected, observed, ok in results:
    print(f"{'PASS' if ok else 'FAIL'}  {what:<{width}}  expected {expected!r}, observed {observed!r}")
assert all(r[3] for r in results), 'fixture outcomes differ from what the fixture was built to contain'
print(f'fixture test passed: {len(results)} expected outcomes observed')
PY
