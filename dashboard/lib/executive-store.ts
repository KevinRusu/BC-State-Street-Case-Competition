// The executive view's reads of outputs/store.duckdb: scorecard, indicators, KPIs, accounts, dollar impact,
// sensitivity and the stress test (read-only; every value a bound parameter, every table name a literal here).
// Plain Node: no Next.js imports, so the tests can call it directly. Pages go through lib/data.ts.
// A blank in the outputs stays null (`maybe`), never 0. A table counts as present only when it has its key column: a
// store built before this change lacks it, and a missing CSV gives a table with a single `note` column.
import type { DuckDBConnection } from "@duckdb/node-api";
import { DOMAIN_SCORE_TARGETS, PAGE_SIZE, RESULTS, RUN_FACTS, WORST_ACCOUNTS, parsePage, resultOf } from "./executive";
import type {
  AccountScore, DomainScore, ExecutiveData, ImpactPage, ImpactRecord, Indicator, IndicatorSeries, Kpi, Lookback,
  OutcomeRecord, Part, RecordFilter, RecordPage, Result, RuleScore, Scenario, ScoreTrio, Sensitivity, Stress, TestScore,
  WorstAccounts,
} from "./executive-types";
import { connect, hasColumn, hasTable, rows, text } from "./store";

type Raw = Record<string, unknown>;

/** A number as the outputs hold it: null, undefined and "" are blanks (null); anything else is `Number(v)`. */
export const maybe = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

/** Whether a table is there with its key column (it then holds its CSV's columns, not just `note`). */
const present = (con: DuckDBConnection, table: string, key: string) => hasColumn(con, table, key);

const count = async (con: DuckDBConnection, sql: string, params: (string | number)[] = []) =>
  Number((await rows(con, sql, params))[0].n);

/** Text order by code point: the same on every machine. */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const trio = (r: Raw): ScoreTrio => ({
  score: maybe(r.score), coverage: maybe(r.coverage), confirmedOnly: maybe(r.confirmed_only_score),
});

// ---------------------------------------------------------------------------------------------------------------
// Scorecard: platform, domains, rules and their tests.

async function readRules(con: DuckDBConnection): Promise<RuleScore[]> {
  const names = new Map<string, string>();
  if (await hasTable(con, "plain_text")) {
    for (const r of await rows(con, "SELECT key, text FROM plain_text WHERE kind = 'rule'")) names.set(text(r.key), text(r.text));
  }
  const catalog = new Map((await rows(con, "SELECT rule_id, test, on_fail FROM rule_catalog")).map((r) => [text(r.rule_id), r]));
  const tests = new Map<string, TestScore[]>();
  for (const r of await rows(con, "SELECT * FROM scorecard WHERE level = 'test' ORDER BY test, rowid")) {
    const key = `${text(r.domain)}\u0000${text(r.rule)}`;
    if (!tests.has(key)) tests.set(key, []);
    tests.get(key)!.push({
      test: text(r.test), unitKind: text(r.unit_kind), ...trio(r), population: maybe(r.population),
      evaluable: maybe(r.evaluable), passed: maybe(r.passed), failedConfirmed: maybe(r.failed_confirmed),
      failedUnresolved: maybe(r.failed_unresolved), cleared: maybe(r.cleared), notEvaluable: maybe(r.not_evaluable),
    });
  }
  return (await rows(con, "SELECT * FROM scorecard WHERE level = 'rule' ORDER BY rowid")).map((r) => {
    const domain = text(r.domain), rule = text(r.rule), entry = catalog.get(rule);
    return {
      domain, rule, name: names.get(rule) || rule, owner: text(r.owner), whatItTests: text(entry?.test),
      onFail: text(entry?.on_fail), tests: tests.get(`${domain}\u0000${rule}`) ?? [], ...trio(r),
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Listed records (rule and account pages). Counts, filters and paging are on records, never on rows (spec §4, §5.4).

/** The register's plain wording per finding (the first line's, when a finding has several lines). */
async function plainWording(con: DuckDBConnection): Promise<Map<string, string>> {
  if (!(await hasColumn(con, "register", "plain"))) return new Map();
  const found = await rows(con, "SELECT finding, arg_min(plain, line) AS plain FROM register GROUP BY finding");
  return new Map(found.map((r) => [text(r.finding), text(r.plain)]));
}

/** A listed record and the store row it came from (`row_order`, the table's `rowid`): the last sort key, so records
 * that tie on every other key keep one order and a page cut is the same on every request. */
type Listed = { record: OutcomeRecord; row: number };

function toRecords(raw: Raw[], plain: Map<string, string>, accountsOf: (r: Raw) => string[]): Listed[] {
  const out: Listed[] = [];
  for (const r of raw) {
    const result = resultOf(text(r.outcome), text(r.confirmed_only_outcome));
    if (result === null) continue; // a plain pass is counted in the scorecard, never listed
    const finding = text(r.line);
    out.push({
      record: {
        domain: text(r.domain), rule: text(r.rule), test: text(r.test), unitKind: text(r.unit_kind),
        recordId: text(r.record_id), accounts: accountsOf(r), holding: text(r.holding), securityId: text(r.security_id),
        result, finding, plain: plain.get(finding) || finding,
      },
      row: Number(r.row_order),
    });
  }
  return out;
}

/** One page of records. The domain filter applies first; `counts` and `findings` are taken before the result and
 * finding filters, so the chips keep their numbers; `domains` before any filter. */
function recordPage(listed: Listed[], filter: RecordFilter): RecordPage {
  const domains = [...new Set(listed.map(({ record: r }) => r.domain))].sort(cmp);
  const inDomain = filter.domain === undefined ? listed : listed.filter(({ record: r }) => r.domain === filter.domain);
  const counts = Object.fromEntries(RESULTS.map((x) => [x, 0])) as Record<Result, number>;
  const byFinding = new Map<string, { finding: string; plain: string; rows: number }>();
  for (const { record: r } of inDomain) {
    counts[r.result] += 1;
    const f = byFinding.get(r.finding) ?? { finding: r.finding, plain: r.plain, rows: 0 };
    f.rows += 1;
    byFinding.set(r.finding, f);
  }
  const findings = [...byFinding.values()].sort((a, b) => b.rows - a.rows || cmp(a.finding, b.finding));
  const shown = inDomain
    .filter(({ record: r }) => (filter.result === undefined || r.result === filter.result)
      && (filter.finding === undefined || r.finding === filter.finding))
    .sort(({ record: a, row: x }, { record: b, row: y }) => RESULTS.indexOf(a.result) - RESULTS.indexOf(b.result)
      || cmp(a.recordId, b.recordId) || cmp(a.test, b.test) || cmp(a.holding, b.holding) || x - y);
  const total = shown.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const page = parsePage(filter.page === undefined ? undefined : String(filter.page), pages);
  return {
    total, page, pages, counts, findings, domains,
    rows: shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(({ record }) => record),
  };
}

/** A rule's units: a `transaction_id` unit listed once per account is one unit with its accounts, sorted; every other
 * row is one unit with zero or one account. `row_order` is the unit's first `rowid`, the last sort key. */
const RULE_UNITS =
  "SELECT domain, rule, test, unit_kind, record_id, min(outcome) AS outcome, " +
  "min(confirmed_only_outcome) AS confirmed_only_outcome, min(line) AS line, " +
  "coalesce(list_sort(list_distinct(list(account_id) FILTER (WHERE trim(account_id) <> ''))), []::VARCHAR[]) AS accounts, " +
  "min(rowid) AS row_order " +
  "FROM score_outcomes WHERE domain = $1 AND rule = $2 AND unit_kind = 'transaction_id' " +
  "GROUP BY domain, rule, test, unit_kind, record_id " +
  "UNION ALL BY NAME " +
  "SELECT domain, rule, test, unit_kind, record_id, outcome, confirmed_only_outcome, line, " +
  "CASE WHEN trim(account_id) <> '' THEN [account_id] ELSE []::VARCHAR[] END AS accounts, rowid AS row_order " +
  "FROM score_outcomes WHERE domain = $1 AND rule = $2 AND unit_kind IS DISTINCT FROM 'transaction_id'";

export async function getRule(domain: string, rule: string, filter: RecordFilter):
  Promise<{ rule: RuleScore; records: RecordPage } | null> {
  const con = await connect();
  try {
    if (!(await present(con, "scorecard", "level"))) return null;
    const found = (await readRules(con)).find((r) => r.domain === domain && r.rule === rule);
    if (!found) return null;
    const raw = (await present(con, "score_outcomes", "record_id")) ? await rows(con, RULE_UNITS, [domain, rule]) : [];
    const records = toRecords(raw, await plainWording(con), (r) => (r.accounts as string[]).map(text));
    return { rule: found, records: recordPage(records, { ...filter, domain: undefined }) };
  } finally {
    con.closeSync();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Accounts.

/** The domains of `scorecard_accounts`: each `<domain> score` column with a `<domain> coverage` beside it, in column
 * order. Read from the table, so a domain added to the scorecard appears without a code change. */
async function accountDomains(con: DuckDBConnection): Promise<string[]> {
  const columns = (await rows(con,
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'scorecard_accounts' ORDER BY ordinal_position",
  )).map((r) => text(r.column_name));
  const all = new Set(columns);
  return columns.filter((c) => c.endsWith(" score") && all.has(`${c.slice(0, -" score".length)} coverage`))
    .map((c) => c.slice(0, -" score".length));
}

const toAccount = (r: Raw, domains: string[]): AccountScore => ({
  accountId: text(r.account_id), inMaster: text(r.in_account_master) === "yes", fundId: text(r.fund_id),
  shareClass: text(r.share_class), rank: maybe(r.rank), ...trio(r), navProximity: maybe(r.score_nav_proximity),
  weakestLink: maybe(r.score_weakest_link),
  domains: domains.map((d) => ({ domain: d, score: maybe(r[`${d} score`]), coverage: maybe(r[`${d} coverage`]) })),
  fundNavResult: text(r.fund_nav_result),
});

const scoredAccounts = (con: DuckDBConnection) =>
  count(con, "SELECT count(*) AS n FROM scorecard_accounts WHERE rank IS NOT NULL");

async function readWorst(con: DuckDBConnection): Promise<WorstAccounts> {
  const domains = await accountDomains(con);
  const shown = (await rows(con, "SELECT * FROM scorecard_accounts WHERE rank IS NOT NULL ORDER BY rank LIMIT $1",
    [WORST_ACCOUNTS])).map((r) => toAccount(r, domains));
  const last = shown[shown.length - 1];
  const tiedBeyond = last && last.rank !== null && last.score !== null
    ? await count(con, "SELECT count(*) AS n FROM scorecard_accounts WHERE rank > $1 AND score = $2", [last.rank, last.score])
    : 0;
  return { rows: shown, scored: await scoredAccounts(con), tiedBeyond };
}

export async function getAccount(id: string, filter: RecordFilter):
  Promise<{ account: AccountScore; scored: number; records: RecordPage; inherited: boolean } | null> {
  const con = await connect();
  try {
    if (!(await present(con, "scorecard_accounts", "account_id"))) return null;
    const [row] = await rows(con, "SELECT * FROM scorecard_accounts WHERE account_id = $1 LIMIT 1", [id]);
    if (!row) return null;
    const account = toAccount(row, await accountDomains(con));
    if (account.rank === null) return null; // listed but no unit, so no score: not a scored account (spec §5.5)
    // Own and inherited units when the notebook wrote them (§5.6); else the account's own units of score_outcomes.
    const inherited = await present(con, "account_outcomes", "account_id");
    const raw = inherited
      ? await rows(con, "SELECT domain, rule, test, unit_kind, record_id, holding, security_id, outcome, " +
        "confirmed_only_outcome, line, rowid AS row_order FROM account_outcomes WHERE account_id = $1", [id])
      : (await present(con, "score_outcomes", "record_id"))
        ? await rows(con, "SELECT domain, rule, test, unit_kind, record_id, outcome, confirmed_only_outcome, line, " +
          "rowid AS row_order FROM score_outcomes WHERE account_id = $1", [id])
        : [];
    const records = recordPage(toRecords(raw, await plainWording(con), () => [id]), filter);
    return { account, scored: await scoredAccounts(con), records, inherited };
  } finally {
    con.closeSync();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Dollar impact. Scenarios overlap and are never added up.

const toScenario = (r: Raw): Scenario => ({
  scenario: text(r.scenario), interpretation: text(r.interpretation), evidence: text(r.evidence),
  accountScope: text(r.account_scope), financialRows: maybe(r.financial_rows), valuedRows: maybe(r.valued_rows),
  unknownRows: maybe(r.unknown_rows), valuationCoverage: maybe(r.valuation_coverage),
  signedUsd: maybe(r.signed_delta_usd_valued_subset), grossUsd: maybe(r.gross_delta_usd_valued_subset),
  maxFundNetBps: maybe(r.max_abs_fund_net_bps_valued_subset), distinctAccounts: maybe(r.distinct_accounts),
  affectedFunds: maybe(r.affected_funds),
});

const toImpact = (r: Raw): ImpactRecord => ({
  accountId: text(r.account_id), securityId: text(r.security_id), fundId: text(r.fund_id),
  deltaUnits: maybe(r.delta_units), deltaUsd: maybe(r.delta_usd), valuationReason: text(r.valuation_reason),
  ledgerId: text(r.ledger_id),
});

export async function getScenario(name: string, filter: { priced?: "yes" | "no"; page?: number }):
  Promise<{ scenario: Scenario; records: ImpactPage } | null> {
  const con = await connect();
  try {
    if (!(await present(con, "severity", "scenario"))) return null;
    const [row] = await rows(con, "SELECT * FROM severity WHERE scenario = $1 LIMIT 1", [name]);
    if (!row) return null;
    const scenario = toScenario(row);
    if (!(await present(con, "impact_detail", "scenario"))) {
      return { scenario, records: { total: 0, page: 1, pages: 0, priced: 0, notPriced: 0, rows: [] } };
    }
    const [c] = await rows(con,
      "SELECT count(delta_usd) AS priced, count(*) - count(delta_usd) AS not_priced FROM impact_detail WHERE scenario = $1",
      [name]);
    const priced = Number(c.priced), notPriced = Number(c.not_priced);
    // Only these two literal conditions are ever added to the SQL.
    const where = filter.priced === "yes" ? " AND delta_usd IS NOT NULL" : filter.priced === "no" ? " AND delta_usd IS NULL" : "";
    const total = filter.priced === "yes" ? priced : filter.priced === "no" ? notPriced : priced + notPriced;
    const pages = Math.ceil(total / PAGE_SIZE);
    const page = parsePage(filter.page === undefined ? undefined : String(filter.page), pages);
    const shown = await rows(con,
      `SELECT * FROM impact_detail WHERE scenario = $1${where} ` +
      "ORDER BY abs(delta_usd) DESC NULLS LAST, account_id, security_id, rowid LIMIT $2 OFFSET $3",
      [name, PAGE_SIZE, (page - 1) * PAGE_SIZE]);
    return { scenario, records: { total, page, pages, priced, notPriced, rows: shown.map(toImpact) } };
  } finally {
    con.closeSync();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Indicators, stress test and the whole page.

async function readIndicators(con: DuckDBConnection): Promise<Indicator[]> {
  const series = new Map<string, IndicatorSeries[]>();
  if (await present(con, "indicator_series", "id")) {
    // Grouped by indicator, key and period in file order; each group's points ordered by start below.
    const groups = new Map<string, IndicatorSeries>();
    for (const r of await rows(con, "SELECT * FROM indicator_series ORDER BY rowid")) {
      const id = text(r.id), key = text(r.key), period = text(r.period);
      const group = `${id}\u0000${key}\u0000${period}`;
      if (!groups.has(group)) {
        const s: IndicatorSeries = { key, period, points: [] };
        groups.set(group, s);
        if (!series.has(id)) series.set(id, []);
        series.get(id)!.push(s);
      }
      groups.get(group)!.points.push({
        start: text(r.start), value: maybe(r.value), threshold: maybe(r.threshold), breach: text(r.breach) === "yes",
      });
    }
    for (const s of groups.values()) s.points.sort((a, b) => cmp(a.start, b.start));
  }
  const lookback = (await present(con, "indicator_lookback", "leading"))
    ? await rows(con, "SELECT * FROM indicator_lookback ORDER BY rowid") : [];
  return (await rows(con, "SELECT * FROM indicators ORDER BY rowid")).map((r) => {
    const id = text(r.id);
    return {
      id, name: id === "I4" ? "Pricing readiness" : text(r.indicator), type: text(r.type),
      status: text(r.status), threshold: text(r.threshold),
      owner: text(r.owner), refresh: text(r.refresh), inputsNeeded: text(r.inputs_needed), value: maybe(r.value),
      unit: text(r.unit), breaches: maybe(r.breaches), firstBreach: text(r.first_breach), series: series.get(id) ?? [],
      lookback: lookback.filter((l) => text(l.leading) === id).map((l): Lookback => ({
        lagging: text(l.lagging), laggingKeys: maybe(l.lagging_keys), flaggedEarlier: maybe(l.flagged_earlier),
        misses: maybe(l.misses), shareFlaggedEarlier: maybe(l.share_flagged_earlier),
        earliestLeadDays: maybe(l.earliest_lead_days), medianLeadDays: maybe(l.median_lead_days), verdict: text(l.verdict),
      })),
    };
  });
}

async function readStress(con: DuckDBConnection): Promise<Stress> {
  const rates = (await rows(con, "SELECT * FROM stress_rates ORDER BY rowid")).map((r) => ({
    role: text(r.role), level: text(r.level), cases: maybe(r.cases), share: maybe(r.share), drawn: maybe(r.drawn),
    wanted: maybe(r.wanted),
  }));
  const measures = (await present(con, "stress_impact", "source"))
    ? (await rows(con, "SELECT * FROM stress_impact WHERE source = 'deliverable' ORDER BY rowid")).map((r) => ({
      measure: text(r.measure), before: maybe(r.before), after: maybe(r.after),
    }))
    : [];
  // Only the run facts the page shows: the file also holds absolute paths, which never leave the store.
  const run: Record<string, string> = {};
  if (await present(con, "stress_run", "item")) {
    for (const r of await rows(con, "SELECT item, value FROM stress_run ORDER BY rowid")) {
      const item = text(r.item);
      if (RUN_FACTS.includes(item)) run[item] = item === "labels sha256" ? text(r.value).slice(0, 12) : text(r.value);
    }
  }
  return { rates, measures, run };
}

export async function getExecutive(): Promise<ExecutiveData> {
  const con = await connect();
  try {
    const missing: Part[] = [];
    const has = async (part: Part, table: string, key: string) => {
      const ok = await present(con, table, key);
      if (!ok) missing.push(part);
      return ok;
    };
    const data: ExecutiveData = {
      unresolvedCredit: null,
      platform: null, domains: [], rules: [], indicators: [], kpis: [],
      worst: { rows: [], scored: 0, tiedBeyond: 0 }, scenarios: [], sensitivity: [], stress: null, missing,
    };
    if (await has("scorecard", "scorecard", "level")) {
      const [platform] = await rows(con, "SELECT * FROM scorecard WHERE level = 'platform' LIMIT 1");
      const [info] = await rows(con, "SELECT * FROM store_info LIMIT 1");
      data.unresolvedCredit = maybe(info?.unresolved_credit);
      data.platform = platform ? trio(platform) : null;
      data.domains = (await rows(con, "SELECT * FROM scorecard WHERE level = 'domain' ORDER BY rowid")).map(
        (r): DomainScore => {
          const domain = text(r.domain);
          return { domain, owner: text(r.owner), target: maybe(r.target) ?? DOMAIN_SCORE_TARGETS.get(domain) ?? null, ...trio(r) };
        });
      data.rules = await readRules(con);
    }
    if (await has("indicators", "indicators", "id")) data.indicators = await readIndicators(con);
    if (await has("kpis", "kpis", "n")) {
      data.kpis = (await rows(con, "SELECT * FROM kpis ORDER BY rowid")).map((r): Kpi => ({
        n: text(r.n), office: text(r.office), kpi: text(r.kpi), formula: text(r.formula), unit: text(r.unit),
        owner: text(r.owner), target: text(r.target), value: maybe(r.value), met: text(r.met), status: text(r.status),
      }));
    }
    if (await has("accounts", "scorecard_accounts", "account_id")) data.worst = await readWorst(con);
    if (await has("impact", "severity", "scenario")) {
      data.scenarios = (await rows(con, "SELECT * FROM severity ORDER BY rowid")).map(toScenario);
    }
    if (await has("sensitivity", "scorecard_sensitivity", "variant")) {
      data.sensitivity = (await rows(con, "SELECT * FROM scorecard_sensitivity ORDER BY rowid")).map((r): Sensitivity => ({
        variant: text(r.variant), level: text(r.level), name: text(r.name), score: maybe(r.score),
        mainScore: maybe(r.main_score), change: maybe(r.change), worstN: maybe(r.worst_n), worstNKept: maybe(r.worst_n_kept),
        tiesAtCutoff: maybe(r.ties_at_cutoff), rankCorrelation: maybe(r.rank_correlation),
      }));
    }
    if (await has("stress", "stress_rates", "role")) data.stress = await readStress(con);
    return data;
  } finally {
    con.closeSync();
  }
}
