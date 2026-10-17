# Defect catalog

*The full write-ups of the four defect classes we take forward (D-017 in [DECISIONS.md](DECISIONS.md)) and the
cleared flag (D-024). Every other finding is one line in [FINDINGS.md](FINDINGS.md). For the same evidence told as a
story, see `docs/checkins/checkin2/STORY.md`.*

**How to read an entry.** Each one answers the seven questions of the Working Guide
([§6](../reference/03_Student_Working_Guide.md)):

- **Generated:** name and status, population and examples sit in the **fact card**. The card is filled from the
  register by `scripts/build_findings.py`; never edit inside it.
- **Written by us:** rule, where it entered, why it matters and what would fix it are judgement, written in prose.
  A number in the prose names its `outputs/` file in a footnote.
- **Reviewed by:** each entry names the teammate who checked the prose and will defend it in the room.

The entries follow the trade's route through the platform, in the same order as the story.

---

## 1. Negative-quantity BUYs · Confirmed

<!-- card: Negative trade quantity -->
*Facts generated from the register (checksum `276759c73a42`) by `scripts/build_findings.py`; do not edit between the markers.*

| Register line | Status | Rule | Affected | Out of (eligible) | Not evaluable | Examples |
|---|---|---|---|---|---|---|
| Negative trade quantity | **confirmed** | TXN_FIELDS_VALID | 655 rows | 1,406,714 | 2,819 | TXN100004247, TXN100006937, TXN100008622 |

- *How detected (Negative trade quantity):* quantity < 0 (by type: BUY 655); gross_amount fits the absolute value on 654 of 655; the book keeps the raw sign, so the reconciliation matches (trace in section 6)
<!-- /card -->

**Rule.** `TXN_FIELDS_VALID` ([RULES.md](RULES.md) §3): the quantity must be above zero. Eligible: every trade row
with a readable quantity; blank quantities can't be tested and are counted apart. A second field backs the flag:
`gross_amount / price` gives the size of the trade, so we can see whether the money agrees with the minus sign.

**Where it entered.** In the trade row as delivered, before the platform touched it. In the traced example, the row
came from `OMS_FRONT` with the minus sign already in it, and nothing later changed the quantity *(observed)*.[^t-src]
Negative quantities are not concentrated in one source: each system's share of them matches its share of all
trades *(observed)*.[^t-pipe] So the stage is **trade capture**, and the handoff is source system → platform. Why
the sources send them is not in the data.

**Why it matters.** The book and the custodian both carry the sign, so reconciliation **matches and hides it**: of
the positions where all three sources agree, 634 contain a negative-quantity trade.[^bc] Each such position
misstates units by twice the trade size. In the traced example that is an indicative exposure of about 19 bps of the
fund's net assets (exposure, not a loss; assumptions in the trace).[^t-down] Who acts: trade operations (fix the
rows), then fund accounting (the holdings feed NAV).

**What would fix it.** Reject at capture: `TXN_FIELDS_VALID`, at the trade check, owned by the **Trade operations
lead**; on fail, **reject** and return to the source. That is prevention. Remediation for the rows already booked:
correct each one against its `gross_amount` and rebuild the positions it feeds. Fixing the positions alone would be
undone by the next feed.

*Reviewed by:* ______

---

## 2. Duplicate trade copies counted as trades · Unresolved (the copies themselves are confirmed)

<!-- card: Repeated transaction_id: exact full-row copy | Repeated transaction_id: copies differ only by date format | Repeated transaction_id: copies conflict on a fact | Repeated transaction_id in the pipeline | Book and custodian count duplicate copies as trades | Book and custodian count duplicate copies and subtract every REVERSED row -->
*Facts generated from the register (checksum `276759c73a42`) by `scripts/build_findings.py`; do not edit between the markers.*

| Register line | Status | Rule | Affected | Out of (eligible) | Not evaluable | Examples |
|---|---|---|---|---|---|---|
| Repeated transaction_id: exact full-row copy | **confirmed** | TXN_DUPLICATE | 4,064 rows | 1,409,533 | 0 | TXN100002453, TXN100002816, TXN100002927 |
| Repeated transaction_id: copies differ only by date format | **confirmed** | TXN_DUPLICATE | 56 rows | 1,409,533 | 0 | TXN100134672, TXN100145058, TXN100161762 |
| Repeated transaction_id: copies conflict on a fact | **unresolved** | TXN_DUPLICATE | 90 rows | 1,409,533 | 0 | TXN100012831, TXN100037265, TXN100040077 |
| Repeated transaction_id in the pipeline | **confirmed** | TXN_PIPELINE_ONE_TO_ONE (added) | 4,210 rows | 1,409,533 | 0 | TXN100002453, TXN100002816, TXN100002927 |
| Book and custodian count duplicate copies as trades | **unresolved** | POS_REBUILD_MATCHES | 2,021 keys | 478,026 | 2,836 | ACC1000158/SEC181706, ACC1011189/SEC676653, ACC1013786/SEC481049 |
| Book and custodian count duplicate copies and subtract every REVERSED row | **unresolved** | POS_REBUILD_MATCHES | 3 keys | 478,026 | 2,836 | ACC4315263/SEC136501, ACC5012849/SEC146187, ACC5072888/SEC707025 |

- *How detected (Repeated transaction_id: exact full-row copy):* transaction_id appears twice and all columns are equal
- *How detected (Repeated transaction_id: copies differ only by date format):* copies equal after normalising both date formats
- *How detected (Repeated transaction_id: copies conflict on a fact):* copies still differ after date normalisation; which copy is right is unknown
- *How detected (Repeated transaction_id in the pipeline):* pipeline_events not one-to-one with transactions
- *How detected (Book and custodian count duplicate copies as trades):* cause rule in section 5; book = custodian, so the custodian cannot catch it
- *How detected (Book and custodian count duplicate copies and subtract every REVERSED row):* cause rule in section 5; book = custodian, so the custodian cannot catch it
<!-- /card -->

**Rule.** `TXN_DUPLICATE` ([RULES.md](RULES.md) §3): a `transaction_id` appears once. Copies that are equal after
normalising the two date formats are removed before the rebuild; copies that still differ make their position not
evaluable (D-006). Then the cause rule `book_counts_duplicate_copies` (D-013, order in `config/reconciliation.toml`):
the book minus the rebuild equals the signed quantity of the removed copies, within the quantity tolerance.

**Where it entered.** In the **pipeline**: the same `transaction_id` arrives twice in `transactions` and twice in
`pipeline_events` (see the card). The copies are confirmed. What happens next is not: book and custodian hold
exactly the quantity you get by counting both copies. That could be a defect in both, or a convention the platform
uses on purpose. It is on our list of questions for faculty (STATUS, open question 4).

**Why it matters.** If the copies are errors, every affected position is overstated by the copied quantity, and the
custodian can't catch it because it agrees with the book (the register's "how detected"). A count of affected
accounts and funds, and an exposure in bps, are not yet in our outputs. They come with the full trace for the final.

**What would fix it.** Prevention: `TXN_DUPLICATE` at the trade check, owned by the **Trade operations lead**. Exact
copies are **rejected**, and copies that differ on a fact are **held** for review. `TXN_PIPELINE_ONE_TO_ONE` (same
owner, **hold**) catches the same resend in the pipeline. Remediation, only once faculty confirm the copies are
errors: remove the copies from the book and rebuild the affected positions.

**What would settle it.** A source message ID or resend flag on each row, or the data owner's statement of the
convention.

*Reviewed by:* ______

---

## 3. Spin-off targets never set up · Confirmed

<!-- card: Corporate-action target security missing from securities | Position on a security_id missing from securities | Held security with no price at all -->
*Facts generated from the register (checksum `276759c73a42`) by `scripts/build_findings.py`; do not edit between the markers.*

| Register line | Status | Rule | Affected | Out of (eligible) | Not evaluable | Examples |
|---|---|---|---|---|---|---|
| Corporate-action target security missing from securities | **confirmed** | CA_TERMS_COMPLETE | 23 events | 23 | 0 | CA00005, CA00009, CA00015 |
| Position on a security_id missing from securities | **confirmed** | POS_KEYS_MASTERED (added) | 1,118 rows | 480,663 | 0 | SEC188562, SEC204363, SEC219998 |
| Held security with no price at all | **confirmed** | PRC_QUOTE_ELIGIBLE | 1,118 position rows | 480,663 | 0 | SEC188562, SEC204363, SEC219998 |

- *How detected (Corporate-action target security missing from securities):* target_security_id not in securities; event quarantined (section 9)
- *How detected (Position on a security_id missing from securities):* positions.security_id not in securities
- *How detected (Held security with no price at all):* positions.security_id absent from prices
<!-- /card -->

**Rule.** `CA_TERMS_COMPLETE` ([RULES.md](RULES.md) §4): a SPINOFF needs a ratio and a `target_security_id` that
exists in `securities` (required terms per type in `config/reconciliation.toml`). An event that fails is quarantined,
not applied (D-016). `POS_KEYS_MASTERED` (§5) flags positions on a security that isn't in the master.

**Where it entered.** In **master data**, at the handoff from corporate actions to the security master. Every
quarantined spin-off fails for the same reason: the new security was never set up.[^ca] The platform then traded and
held those securities anyway: the 1,118 position rows sit on 15 securities, every one a missing spin-off target, with
1,131 trades and 0 prices *(observed, notebook 01)*.[^cc]

**Why it matters.** Master data feeds everything below it, so one missing record spreads. Holders of the parent
security are due new shares that the platform can't describe or price. For example, `CA00005` has 23 candidate
holders.[^ca] The resulting holdings can't be valued, so the funds holding them carry a valuation gap into NAV. A
count of affected accounts and funds is not yet in our outputs (final).

**What would fix it.** Prevention, earliest point first:

1. `CA_TERMS_COMPLETE`, owned by the **Corporate actions lead**: **hold** the event before its ex-date until the
   target is set up.
2. `TXN_SECURITY_NOT_MASTERED`, owned by the **Security master lead**: **hold** any trade on a security that isn't
   in the master.

Remediation: set up the missing securities (identifiers, currency, asset class), then release the held events and
trades and price the holdings.

*Reviewed by:* ______

---

## 4. Custodian missing holdings · Unresolved

<!-- card: Position in the book with no custodian record -->
*Facts generated from the register (checksum `276759c73a42`) by `scripts/build_findings.py`; do not edit between the markers.*

| Register line | Status | Rule | Affected | Out of (eligible) | Not evaluable | Examples |
|---|---|---|---|---|---|---|
| Position in the book with no custodian record | **unresolved** | POS_CUSTODIAN_BREAK | 480 keys | 480,663 | 0 | ACC1012432/SEC471303, ACC1015946/SEC134582, ACC1019552/SEC595458 |

- *How detected (Position in the book with no custodian record):* full outer join book vs custodian; trades support the book on most (section 4): likely a custodian feed gap
<!-- /card -->

**Rule.** `POS_CUSTODIAN_BREAK` ([RULES.md](RULES.md) §5): a full outer join of `positions` and
`comparison_positions` on account + security + date. A position on only one side is reported separately, never as
agreed.

**Where it entered.** Most likely in the **custodian's feed**, at the handoff from custodian to reconciliation
*(inferred)*. The trades back the book: of these positions, 478 also have trades in our rebuild, and on 475 the
rebuild agrees with the book.[^3way] So the book looks right, and the custodian's file looks incomplete. We can't
see the custodian's side, so this stays unresolved.

**Why it matters.** These holdings have no independent confirmation. If the custodian really doesn't hold them,
the book reports assets that may not exist. The reconciliation analyst needs them as a separate queue, apart from
quantity differences. An exposure measure is not yet in our outputs (final).

**What would fix it.** `POS_CUSTODIAN_BREAK`, owned by the **Reconciliation lead**: **flag** each one-sided position
and age it. Prevention needs a data contract with the custodian: the file must cover every account and security the
book reports, with a record count to check on arrival. Remediation: ask the custodian to confirm or deny each
position.

**What would settle it.** The custodian's own statement for these positions, or a feed manifest with record counts.

*Reviewed by:* ______

---

## 5. Closed positions not reported · Cleared

<!-- card: Closed position not reported (trades net to zero, absent from book and custodian) -->
*Facts generated from the register (checksum `276759c73a42`) by `scripts/build_findings.py`; do not edit between the markers.*

| Register line | Status | Rule | Affected | Out of (eligible) | Not evaluable | Examples |
|---|---|---|---|---|---|---|
| Closed position not reported (trades net to zero, absent from book and custodian) | **cleared** | POS_REBUILD_MATCHES | 42 keys | 478,026 | 2,836 | ACC1269575/SEC116404, ACC1319772/SEC586059, ACC1412582/SEC722924 |

- *How detected (Closed position not reported (trades net to zero, absent from book and custodian)):* positions stores 0 and comparison_positions 0 zero-quantity rows: neither source reports flat positions, so their absence is expected. Would reopen: a zero row in either source, or a later non-zero record
<!-- /card -->

Clearing a flag needs a stated rule, independent evidence, the population, and what would change our mind (Working
Guide [§5](../reference/03_Student_Working_Guide.md)).

**Rule, written before looking** (D-024). A position whose trades net to zero within the quantity tolerance, and
that neither the book nor the custodian reports, is a closed position that simply isn't listed.

**Independent evidence.** It comes from the sources' own tables, not from the flagged positions: neither `positions`
nor `comparison_positions` stores a single zero-quantity row anywhere (see "how detected" in the card). Silence about
a closed position is their normal behaviour. Our first argument, "the custodian is also silent", held by
construction and proved nothing, which is why D-024 replaced it.

**Population.** In the card. The rule cleared every position it applies to. Whether it cleared something it
shouldn't: the rule only fires when *both* sources are silent *and* the trades net to zero, so a position the book
reports can never be cleared by it. Half of the reopen test runs today (no zero rows anywhere). The other half, a
later non-zero record, needs a later release, because we have only one snapshot.

**Where it entered / why it matters / what would fix it.** No defect entered. It matters because, without the rule,
these positions would sit in the break queue as false alarms. No fix is needed. The convention ("flat positions are
not reported") belongs in the data contract between the custodian and reconciliation, so the rule rests on a stated
agreement and not on our reading of the data.

**What would change our mind.** A zero-quantity row in either source, or a later non-zero record for one of these
positions.

*Reviewed by:* ______

---

[^t-src]: `outputs/02_trace.csv`, hop `source`, rows `source_system` and "where it entered".
[^t-pipe]: `outputs/02_trace.csv`, hop `pipeline`, row "share of negative quantities by source_system" (and its note:
    share of all rows by source_system).
[^t-down]: `outputs/02_trace.csv`, hop `downstream`, row "indicative exposure (bps of fund net assets)" = 19.4048.
[^bc]: `outputs/02_break_classes.csv`, class "all three agree", column `sign_conflict_keys`.
[^ca]: `outputs/02_ca_readiness.csv`: SPINOFF rows with reason `TARGET_NOT_MASTERED`; `candidate holders` of
    `CA00005`.
[^cc]: `outputs/01_cross_check.csv`, rows "missing spin-off targets traded and held", "…: transaction rows",
    "…: position rows", "…: price rows".
[^3way]: `outputs/02_three_way_summary.csv`, row "rebuild + book, no custodian" (keys, "of which the two present
    agree").
