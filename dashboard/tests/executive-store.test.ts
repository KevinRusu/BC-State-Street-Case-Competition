// The executive view's reads (lib/executive-store.ts) on a store built from tests/fixtures/small, compared with the
// CSV files that store copied (they sit beside it). Expected values are read from those files, never typed. The
// fixture is made up, so its IDs may appear here.
import fs from "node:fs";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection, type DuckDBValue } from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DOMAIN_SCORE_TARGETS, PAGE_SIZE, RESULTS, RUN_FACTS, WORST_ACCOUNTS, parseResult, stressState } from "@/lib/executive";
import { getAccount, getExecutive, getRule, getScenario, maybe } from "@/lib/executive-store";
import type { ExecutiveData, OutcomeRecord, RecordFilter, Result } from "@/lib/executive-types";
import { storePath } from "@/lib/store";

type CsvRow = Record<string, string | null>;

let reader: DuckDBInstance;
let csvCon: DuckDBConnection;
let exec: ExecutiveData;

beforeAll(async () => {
  expect(process.env.STORE_PATH, "run npm test or tests/store_test.sh").toBeTruthy();
  reader = await DuckDBInstance.create(":memory:");
  csvCon = await reader.connect();
  exec = await getExecutive();
});

afterAll(() => {
  csvCon.closeSync();
  reader.closeSync();
});

/** The rows of a CSV the store copied, as text (a blank cell is null). */
async function csv(file: string, where = "", params: DuckDBValue[] = []): Promise<CsvRow[]> {
  const result = await csvCon.runAndReadAll(
    `SELECT * FROM read_csv($1, all_varchar = true, header = true) ${where}`,
    [path.join(path.dirname(storePath()), file), ...params]);
  return result.getRowObjectsJson() as CsvRow[];
}

/** A number as the outputs hold it: a blank is null, never 0. */
const n = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));

/** A writable copy of the fixture store (the `copyStore` pattern of store.test.ts), changed by `change`. */
async function copyStore(name: string, change: (con: DuckDBConnection) => Promise<void>): Promise<string> {
  const copy = path.join(path.dirname(storePath()), name);
  fs.rmSync(`${copy}.wal`, { force: true });
  fs.copyFileSync(storePath(), copy);
  const writer = await DuckDBInstance.create(copy);
  const con = await writer.connect();
  try {
    await change(con);
  } finally {
    con.closeSync();
    writer.closeSync();
  }
  return copy;
}

/** Runs `read` with the reads pointed at another store file. */
async function onStore<T>(file: string, read: () => Promise<T>): Promise<T> {
  const saved = process.env.STORE_PATH;
  process.env.STORE_PATH = file;
  try {
    return await read();
  } finally {
    process.env.STORE_PATH = saved;
  }
}

/** Every record of a rule, page after page. */
async function allRuleRecords(domain: string, rule: string, filter: RecordFilter = {}): Promise<OutcomeRecord[]> {
  const out: OutcomeRecord[] = [];
  for (let page = 1; ; page++) {
    const got = await getRule(domain, rule, { ...filter, page });
    if (!got) throw new Error(`${domain}/${rule} not found`);
    out.push(...got.records.rows);
    if (page >= got.records.pages) return out;
  }
}

/** Every record of an account, page after page. */
async function allAccountRecords(id: string): Promise<OutcomeRecord[]> {
  const out: OutcomeRecord[] = [];
  for (let page = 1; ; page++) {
    const got = await getAccount(id, { page });
    if (!got) throw new Error(`${id} not found`);
    out.push(...got.records.rows);
    if (page >= got.records.pages) return out;
  }
}

test("maybe keeps a blank blank", () => {
  for (const blank of [null, undefined, ""]) expect(maybe(blank)).toBeNull();
  expect(maybe("0")).toBe(0);
  expect(maybe(0)).toBe(0);
  expect(maybe("12.5")).toBe(12.5);
});

describe("scorecard", () => {
  test("platform, domains and rules equal 02_scorecard.csv", async () => {
    const trio = (r: CsvRow) => ({ score: n(r.score), coverage: n(r.coverage), confirmedOnly: n(r.confirmed_only_score) });
    const [platform] = await csv("02_scorecard.csv", "WHERE level = 'platform'");
    expect(exec.platform).toEqual(trio(platform));

    const domains = await csv("02_scorecard.csv", "WHERE level = 'domain'");
    expect(exec.domains.map((d) => d.domain)).toEqual(domains.map((r) => r.domain));
    for (const r of domains) {
      expect(exec.domains.find((d) => d.domain === r.domain), r.domain!).toEqual({
        domain: r.domain, owner: r.owner ?? "", target: n(r.target) ?? DOMAIN_SCORE_TARGETS.get(r.domain!) ?? null, ...trio(r),
      });
    }

    const rules = await csv("02_scorecard.csv", "WHERE level = 'rule'");
    expect(exec.rules.map((r) => `${r.domain}/${r.rule}`)).toEqual(rules.map((r) => `${r.domain}/${r.rule}`));
    for (const r of rules) {
      const got = exec.rules.find((x) => x.domain === r.domain && x.rule === r.rule)!;
      expect({ score: got.score, coverage: got.coverage, confirmedOnly: got.confirmedOnly, owner: got.owner },
        `${r.domain}/${r.rule}`).toEqual({ ...trio(r), owner: r.owner ?? "" });
      const tests = await csv("02_scorecard.csv", "WHERE level = 'test' AND domain = $2 AND rule = $3 ORDER BY test",
        [r.domain, r.rule]);
      expect(got.tests).toEqual(tests.map((t) => ({
        test: t.test, unitKind: t.unit_kind, ...trio(t), population: n(t.population), evaluable: n(t.evaluable),
        passed: n(t.passed), failedConfirmed: n(t.failed_confirmed), failedUnresolved: n(t.failed_unresolved),
        cleared: n(t.cleared), notEvaluable: n(t.not_evaluable),
      })));
    }
    expect(exec.missing).toEqual([]);
  });

  test("a published domain target takes precedence over its pilot target", async () => {
    const file = await copyStore("domain-target.duckdb", async (con) => {
      await con.run("ALTER TABLE scorecard ADD COLUMN target DOUBLE");
      await con.run("UPDATE scorecard SET target = 98 WHERE level = 'domain' AND domain = 'Accounts'");
    });
    const { domains } = await onStore(file, getExecutive);
    expect(domains.find((d) => d.domain === "Accounts")?.target).toBe(98);
    expect(domains.find((d) => d.domain === "Prices")?.target).toBe(99);
  });

  test("a rule has its plain name, what it tests and its on-fail action", async () => {
    const got = exec.rules.find((r) => r.rule === "TXN_DUPLICATE")!;
    expect(got.name).not.toBe("TXN_DUPLICATE");
    expect(got.name).not.toBe("");
    expect(got.whatItTests).not.toBe("");
    expect(got.onFail).not.toBe("");
  });

  test("every test's listed records reconcile with its scorecard counts", async () => {
    expect(exec.rules.length).toBeGreaterThan(0);
    for (const rule of exec.rules) {
      const records = await allRuleRecords(rule.domain, rule.rule);
      const page = (await getRule(rule.domain, rule.rule, {}))!.records;
      expect(records).toHaveLength(page.total);
      for (const t of rule.tests) {
        const count = (result: Result) => records.filter((r) => r.test === t.test && r.result === result).length;
        const where = `${rule.domain}/${rule.rule}/${t.test}`;
        expect(count("confirmed fail"), where).toBe(t.failedConfirmed);
        expect(count("unresolved fail"), where).toBe(t.failedUnresolved);
        expect(count("not evaluable"), where).toBe(t.notEvaluable);
        expect(count("cleared"), where).toBe(t.cleared);
      }
      // Every listed record belongs to one of the scorecard's tests: none sits on a test the scorecard lacks.
      const counted = rule.tests.reduce((s, t) => s + (t.failedConfirmed ?? 0) + (t.failedUnresolved ?? 0)
        + (t.notEvaluable ?? 0) + (t.cleared ?? 0), 0);
      expect(counted, `${rule.domain}/${rule.rule}`).toBe(records.length);
      for (const result of RESULTS) {
        expect(page.counts[result], `${rule.rule} ${result}`).toBe(records.filter((r) => r.result === result).length);
      }
      expect(records.every((r) => r.holding === "" && r.securityId === "")).toBe(true);
    }
  });

  test("records are ordered by result, then record ID, and carry the register's plain wording", async () => {
    const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    for (const rule of exec.rules) {
      const records = await allRuleRecords(rule.domain, rule.rule);
      expect(records, rule.rule).toEqual([...records].sort((a, b) => RESULTS.indexOf(a.result) - RESULTS.indexOf(b.result)
        || cmp(a.recordId, b.recordId) || cmp(a.test, b.test) || cmp(a.holding, b.holding)));
    }
    const records = await allRuleRecords("Trades", "TXN_FIELDS_VALID");
    const negative = records.find((r) => r.finding === "Negative trade quantity")!;
    const [line] = await csv("02_defect_register.csv", "WHERE finding = $2", [negative.finding]);
    expect(negative.plain).not.toBe("");
    expect(negative.plain).not.toBe(negative.finding);
    expect(line).toBeDefined();
  });

  test("two copies of a trade row are two records", async () => {
    const records = await allRuleRecords("Trades", "TXN_DUPLICATE", { result: "confirmed fail" });
    const rows = await csv("02_score_outcomes.csv",
      "WHERE domain = 'Trades' AND rule = 'TXN_DUPLICATE' AND test = 'TRD.copies'");
    expect(records.filter((r) => r.test === "TRD.copies")).toHaveLength(rows.length);
  });

  test("a transaction ID listed on two accounts is one record", async () => {
    const [unit] = await csv("02_score_outcomes.csv", "WHERE unit_kind = 'transaction_id' ORDER BY test, record_id LIMIT 1");
    const [other] = await csv("02_scorecard_accounts.csv", "WHERE account_id <> $2 ORDER BY account_id LIMIT 1",
      [unit.account_id]);
    const before = (await getRule(unit.domain!, unit.rule!, {}))!.records;
    const copy = await copyStore("store_two_accounts.duckdb", async (con) => {
      await con.run("INSERT INTO score_outcomes SELECT * REPLACE ($1 AS account_id) FROM score_outcomes " +
        "WHERE test = $2 AND record_id = $3", [other.account_id, unit.test, unit.record_id]);
    });
    const after = await onStore(copy, async () => {
      const page = (await getRule(unit.domain!, unit.rule!, {}))!.records;
      const records = await allRuleRecords(unit.domain!, unit.rule!);
      return { page, record: records.find((r) => r.test === unit.test && r.recordId === unit.record_id)! };
    });
    expect(after.page.total).toBe(before.total);
    expect(after.page.counts).toEqual(before.counts);
    expect(after.record.accounts).toEqual([unit.account_id!, other.account_id!].sort());
  });

  test("records that tie on every sort key keep the store's row order, request after request", async () => {
    const [unit] = await csv("02_score_outcomes.csv",
      "WHERE unit_kind <> 'transaction_id' AND outcome = 'fail' " +
      "QUALIFY count(*) OVER (PARTITION BY domain, rule, test, record_id) = 1 " +
      "ORDER BY domain, rule, test, record_id LIMIT 1");
    expect(unit, "the fixture has a failed unit that is not a transaction ID").toBeDefined();
    // Two copies of the unit on two made-up accounts, inserted against the accounts' text order.
    const copy = await copyStore("store_tied_records.duckdb", async (con) => {
      const found = await con.runAndReadAll(
        "SELECT min(rowid) AS r FROM score_outcomes WHERE domain = $1 AND rule = $2 AND test = $3 AND record_id = $4",
        [unit.domain, unit.rule, unit.test, unit.record_id]);
      const original = Number(found.getRowObjectsJson()[0].r);
      for (const account of ["FXTIE2", "FXTIE1"]) {
        await con.run("INSERT INTO score_outcomes SELECT * REPLACE ($1 AS account_id) FROM score_outcomes WHERE rowid = $2",
          [account, original]);
      }
    });
    const read = () => onStore(copy, async () => (await allRuleRecords(unit.domain!, unit.rule!))
      .filter((r) => r.test === unit.test && r.recordId === unit.record_id).map((r) => r.accounts));
    const first = await read();
    expect(first).toHaveLength(3);
    expect(first.slice(1)).toEqual([["FXTIE2"], ["FXTIE1"]]);
    expect(await read()).toEqual(first);
  });

  test("a result and a finding filter narrow the list; the chips keep their numbers", async () => {
    const all = (await getRule("Trades", "TXN_FIELDS_VALID", {}))!.records;
    const finding = all.findings[0];
    const byFinding = (await getRule("Trades", "TXN_FIELDS_VALID", { finding: finding.finding }))!.records;
    expect(byFinding.total).toBe(finding.rows);
    expect(byFinding.counts).toEqual(all.counts);
    expect(byFinding.findings).toEqual(all.findings);
    const byResult = (await getRule("Trades", "TXN_FIELDS_VALID", { result: "not evaluable" }))!.records;
    expect(byResult.total).toBe(all.counts["not evaluable"]);
    expect(byResult.rows.every((r) => r.result === "not evaluable")).toBe(true);
    expect(byResult.counts).toEqual(all.counts);
    expect(byResult.findings).toEqual(all.findings);
    expect(Object.values(all.counts).filter((c) => c > 0).length, "the rule has two results").toBeGreaterThan(1);
    expect(all.findings.reduce((s, f) => s + f.rows, 0)).toBe(all.total);
    expect(all.findings.length, "the rule has two findings").toBeGreaterThan(1);
  });
});

describe("accounts", () => {
  test("an account's records are the rows of 02_account_outcomes.csv", async () => {
    const accounts = await csv("02_scorecard_accounts.csv", "WHERE rank IS NOT NULL");
    expect(accounts.length).toBeGreaterThan(0);
    for (const a of accounts) {
      const rows = await csv("02_account_outcomes.csv", "WHERE account_id = $2", [a.account_id]);
      const got = (await getAccount(a.account_id!, {}))!;
      expect(got.records.total, a.account_id!).toBe(rows.length);
      expect(got.inherited).toBe(true);
      expect(got.scored).toBe(accounts.length);
      const records = await allAccountRecords(a.account_id!);
      expect(records.every((r) => r.accounts.length === 1 && r.accounts[0] === a.account_id)).toBe(true);
      expect(records.map((r) => `${r.test} ${r.recordId} ${r.holding}`).sort(), a.account_id!)
        .toEqual(rows.map((r) => `${r.test} ${r.record_id} ${r.holding ?? ""}`).sort());
    }
  });

  test("an account's score, its sensitivity scores and its domains equal 02_scorecard_accounts.csv", async () => {
    const [a] = await csv("02_scorecard_accounts.csv", "ORDER BY account_id LIMIT 1");
    const got = (await getAccount(a.account_id!, {}))!.account;
    expect(got).toMatchObject({
      accountId: a.account_id, inMaster: a.in_account_master === "yes", fundId: a.fund_id, shareClass: a.share_class,
      rank: n(a.rank), score: n(a.score), coverage: n(a.coverage), confirmedOnly: n(a.confirmed_only_score),
      navProximity: n(a.score_nav_proximity), weakestLink: n(a.score_weakest_link), fundNavResult: a.fund_nav_result,
    });
    const domains = Object.keys(a).filter((c) => c.endsWith(" score") && `${c.slice(0, -6)} coverage` in a)
      .map((c) => c.slice(0, -6));
    expect(domains.length).toBeGreaterThan(0);
    expect(got.domains).toEqual(domains.map((d) => ({ domain: d, score: n(a[`${d} score`]), coverage: n(a[`${d} coverage`]) })));
  });

  test("a blank domain score stays null", async () => {
    const accounts = await csv("02_scorecard_accounts.csv");
    const blank = accounts.flatMap((a) => Object.keys(a)
      .filter((c) => c.endsWith(" score") && a[c] === null).map((c) => ({ id: a.account_id!, domain: c.slice(0, -6) })))[0];
    expect(blank, "the fixture has an account with a blank domain score").toBeDefined();
    const got = (await getAccount(blank.id, {}))!.account;
    expect(got.domains.find((d) => d.domain === blank.domain)?.score).toBeNull();
  });

  test("a domain filter narrows the records and lists the domains present", async () => {
    const [a] = await csv("02_account_outcomes.csv", "ORDER BY account_id LIMIT 1");
    const rows = await csv("02_account_outcomes.csv", "WHERE account_id = $2", [a.account_id]);
    const all = (await getAccount(a.account_id!, {}))!.records;
    expect(all.domains).toEqual([...new Set(rows.map((r) => r.domain!))].sort());
    const domain = all.domains[0];
    const narrowed = (await getAccount(a.account_id!, { domain }))!.records;
    expect(narrowed.total).toBe(rows.filter((r) => r.domain === domain).length);
    expect(narrowed.domains).toEqual(all.domains);
    expect(narrowed.rows.every((r) => r.domain === domain)).toBe(true);
  });

  test("an inherited record carries its holding", async () => {
    const [a] = await csv("02_scorecard_accounts.csv", "WHERE rank IS NOT NULL ORDER BY account_id LIMIT 1");
    const before = (await getAccount(a.account_id!, {}))!.records.total;
    const copy = await copyStore("store_inherited.duckdb", async (con) => {
      await con.run("INSERT INTO account_outcomes (account_id, domain, rule, test, unit_kind, record_id, holding, " +
        "security_id, outcome, confirmed_only_outcome, line) VALUES ($1, 'Prices', 'PRC_QUOTE_ELIGIBLE', " +
        "'PRC.freshness', 'security', 'FXSEC9', 'FXP_MADE_UP', 'FXSEC9', 'fail', 'fail', 'Made-up stale price')",
      [a.account_id]);
    });
    const after = await onStore(copy, () => getAccount(a.account_id!, {}));
    expect(after!.records.total).toBe(before + 1);
    expect(after!.records.rows.find((r) => r.recordId === "FXSEC9")).toMatchObject({
      holding: "FXP_MADE_UP", securityId: "FXSEC9", unitKind: "security", result: "confirmed fail",
      finding: "Made-up stale price", plain: "Made-up stale price", accounts: [a.account_id],
    });
  });

  test("an account's records that tie on every sort key keep the store's row order, request after request", async () => {
    const [a] = await csv("02_scorecard_accounts.csv", "WHERE rank IS NOT NULL ORDER BY account_id LIMIT 1");
    // Two made-up records alike in result, record ID, test and holding, inserted against their findings' text order.
    const copy = await copyStore("store_tied_account_records.duckdb", async (con) => {
      for (const line of ["Made-up tie B", "Made-up tie A"]) {
        await con.run("INSERT INTO account_outcomes (account_id, domain, rule, test, unit_kind, record_id, holding, " +
          "security_id, outcome, confirmed_only_outcome, line) VALUES ($1, 'Prices', 'PRC_QUOTE_ELIGIBLE', " +
          "'PRC.freshness', 'security', 'FXSEC9', 'FXP_MADE_UP', 'FXSEC9', 'fail', 'fail', $2)", [a.account_id, line]);
      }
    });
    const read = () => onStore(copy, async () => {
      const out: string[] = [];
      for (let page = 1; ; page++) {
        const got = (await getAccount(a.account_id!, { page }))!.records;
        out.push(...got.rows.filter((r) => r.recordId === "FXSEC9").map((r) => r.finding));
        if (page >= got.pages) return out;
      }
    });
    const first = await read();
    expect(first).toEqual(["Made-up tie B", "Made-up tie A"]);
    expect(await read()).toEqual(first);
  });

  test("an account without a rank (no unit, so no score) is not a scored account", async () => {
    const [a] = await csv("02_scorecard_accounts.csv", "WHERE rank IS NOT NULL ORDER BY account_id LIMIT 1");
    expect(await getAccount(a.account_id!, {})).not.toBeNull();
    // A copy where that account has no unit: its rank and scores are blank, as the notebook writes such an account.
    const copy = await copyStore("store_unranked_account.duckdb", async (con) => {
      await con.run("DELETE FROM account_outcomes WHERE account_id = $1", [a.account_id]);
      await con.run("DELETE FROM score_outcomes WHERE account_id = $1", [a.account_id]);
      await con.run("UPDATE scorecard_accounts SET rank = NULL, score = NULL, coverage = NULL, " +
        "confirmed_only_score = NULL WHERE account_id = $1", [a.account_id]);
    });
    expect(await onStore(copy, () => getAccount(a.account_id!, {}))).toBeNull();
  });

  test("worst accounts are the lowest ranks, with the tie note", async () => {
    const accounts = await csv("02_scorecard_accounts.csv", "WHERE rank IS NOT NULL");
    const shown = Math.min(WORST_ACCOUNTS, accounts.length);
    expect(exec.worst.scored).toBe(accounts.length);
    expect(exec.worst.rows.map((r) => r.rank)).toEqual(Array.from({ length: shown }, (_, i) => i + 1));
    const last = exec.worst.rows[shown - 1];
    const tied = accounts.filter((a) => n(a.rank)! > shown && n(a.score) === last.score).length;
    expect(exec.worst.tiedBeyond).toBe(tied);
  });
});

describe("dollar impact", () => {
  test("an unpriced scenario stays null", async () => {
    const [blank] = await csv("02_severity.csv", "WHERE gross_delta_usd_valued_subset IS NULL LIMIT 1");
    const [zero] = await csv("02_severity.csv", "WHERE gross_delta_usd_valued_subset = '0.0' LIMIT 1");
    expect(blank && zero, "the fixture has a blank and a 0.0 scenario").toBeTruthy();
    expect(exec.scenarios.find((s) => s.scenario === blank.scenario)!.grossUsd).toBeNull();
    expect(exec.scenarios.find((s) => s.scenario === zero.scenario)!.grossUsd).toBe(0);
    expect((await getScenario(blank.scenario!, {}))!.scenario.grossUsd).toBeNull();
  });

  test("scenarios equal 02_severity.csv", async () => {
    const rows = await csv("02_severity.csv");
    expect(exec.scenarios).toEqual(rows.map((r) => ({
      scenario: r.scenario, interpretation: r.interpretation, evidence: r.evidence, accountScope: r.account_scope,
      financialRows: n(r.financial_rows), valuedRows: n(r.valued_rows), unknownRows: n(r.unknown_rows),
      valuationCoverage: n(r.valuation_coverage), signedUsd: n(r.signed_delta_usd_valued_subset),
      grossUsd: n(r.gross_delta_usd_valued_subset), maxFundNetBps: n(r.max_abs_fund_net_bps_valued_subset),
      distinctAccounts: n(r.distinct_accounts), affectedFunds: n(r.affected_funds),
    })));
  });

  test("scenario records are ordered by absolute dollars, unpriced last", async () => {
    const scenarios = await csv("02_severity.csv");
    for (const s of scenarios) {
      const rows = await csv("02_impact_detail.csv", "WHERE scenario = $2", [s.scenario]);
      const got = (await getScenario(s.scenario!, {}))!.records;
      expect(got.total, s.scenario!).toBe(rows.length);
      expect(got.priced + got.notPriced).toBe(got.total);
    }
    // A copy with an unpriced row on the scenario with the most rows.
    const detail = await csv("02_impact_detail.csv");
    const rowsOf = (name: string) => detail.filter((r) => r.scenario === name).length;
    const name = [...new Set(detail.map((r) => r.scenario!))].sort((a, b) => rowsOf(b) - rowsOf(a))[0];
    const copy = await copyStore("store_unpriced.duckdb", async (con) => {
      await con.run("INSERT INTO impact_detail SELECT * REPLACE ('FXACC0' AS account_id, NULL AS delta_usd, " +
        "'made up: not priced' AS valuation_reason) FROM impact_detail WHERE scenario = $1 LIMIT 1", [name]);
    });
    const { all, priced, notPriced } = await onStore(copy, async () => ({
      all: (await getScenario(name, {}))!.records,
      priced: (await getScenario(name, { priced: "yes" }))!.records,
      notPriced: (await getScenario(name, { priced: "no" }))!.records,
    }));
    const usd = all.rows.map((r) => r.deltaUsd);
    expect(usd[usd.length - 1]).toBeNull();
    const valued = usd.filter((v): v is number => v !== null).map(Math.abs);
    expect(valued).toEqual([...valued].sort((a, b) => b - a));
    expect(all.priced + all.notPriced).toBe(all.total);
    expect(all.notPriced).toBe(1);
    expect(priced.total).toBe(all.priced);
    expect(priced.rows.every((r) => r.deltaUsd !== null)).toBe(true);
    expect(notPriced.total).toBe(1);
    expect(notPriced.rows[0]).toMatchObject({ accountId: "FXACC0", deltaUsd: null, valuationReason: "made up: not priced" });
    expect(notPriced.priced).toBe(all.priced); // counted before the filter
  });
});

describe("indicators and KPIs", () => {
  test("a proposed indicator has no value", async () => {
    const proposed = exec.indicators.filter((i) => i.status === "proposed");
    expect(proposed.length).toBeGreaterThan(0);
    for (const i of proposed) {
      expect(i.value, i.id).toBeNull();
      expect(i.inputsNeeded, i.id).not.toBe("");
    }
    const rows = await csv("02_indicators.csv");
    expect(exec.indicators.map((i) => i.id)).toEqual(rows.map((r) => r.id));
    for (const r of rows) {
      expect(exec.indicators.find((i) => i.id === r.id), r.id!).toMatchObject({
        name: r.id === "I4" ? "Pricing readiness" : r.indicator,
        type: r.type, status: r.status, value: n(r.value), unit: r.unit ?? "",
        breaches: n(r.breaches), firstBreach: r.first_breach ?? "", inputsNeeded: r.inputs_needed ?? "",
      });
    }
  });

  test("series are ordered by start", async () => {
    for (const i of exec.indicators) {
      const rows = await csv("02_indicator_series.csv", "WHERE id = $2", [i.id]);
      expect(i.series.reduce((s, x) => s + x.points.length, 0), i.id).toBe(rows.length);
      for (const s of i.series) {
        const starts = s.points.map((p) => p.start);
        expect(starts, `${i.id} ${s.key} ${s.period}`).toEqual([...starts].sort());
        for (const p of s.points) {
          const row = rows.find((r) => r.key === s.key && r.period === s.period && r.start === p.start)!;
          expect(p).toEqual({ start: row.start, value: n(row.value), threshold: n(row.threshold), breach: row.breach === "yes" });
        }
      }
      const lookback = await csv("02_indicator_lookback.csv", "WHERE \"leading\" = $2", [i.id]);
      expect(i.lookback.map((l) => l.lagging), i.id).toEqual(lookback.map((l) => l.lagging));
    }
    expect(exec.indicators.some((i) => i.series.some((s) => s.points.some((p) => p.breach)))).toBe(true);
  });

  test("KPIs equal 02_kpis.csv", async () => {
    const rows = await csv("02_kpis.csv");
    expect(exec.kpis).toEqual(rows.map((r) => ({
      n: r.n, office: r.office, kpi: r.kpi, formula: r.formula ?? "", unit: r.unit ?? "", owner: r.owner ?? "",
      target: r.target ?? "", value: n(r.value), met: r.met ?? "", status: r.status ?? "",
    })));
  });

  test("sensitivity variants equal 02_scorecard_sensitivity.csv", async () => {
    const rows = await csv("02_scorecard_sensitivity.csv");
    expect(exec.sensitivity).toEqual(rows.map((r) => ({
      variant: r.variant, level: r.level, name: r.name ?? "", score: n(r.score), mainScore: n(r.main_score),
      change: n(r.change), worstN: n(r.worst_n), worstNKept: n(r.worst_n_kept), tiesAtCutoff: n(r.ties_at_cutoff),
      rankCorrelation: n(r.rank_correlation),
    })));
  });
});

describe("stress", () => {
  test("stress: measures, rates and run facts, never a path", async () => {
    const stress = exec.stress!;
    expect(stress).not.toBeNull();
    const rates = await csv("03_stress_rates.csv");
    expect(stress.rates).toEqual(rates.map((r) => ({
      role: r.role, level: r.level, cases: n(r.cases), share: n(r.share), drawn: n(r.drawn), wanted: n(r.wanted),
    })));
    const measures = await csv("03_stress_impact.csv", "WHERE source = 'deliverable'");
    expect(stress.measures).toEqual(measures.map((m) => ({ measure: m.measure, before: n(m.before), after: n(m.after) })));
    const run = await csv("03_stress_run.csv");
    expect(Object.keys(stress.run).sort()).toEqual(run.map((r) => r.item!).filter((i) => RUN_FACTS.includes(i)).sort());
    expect(Object.keys(stress.run).some((k) => k.includes("path"))).toBe(false);
    expect(Object.values(stress.run).some((v) => v.includes("/"))).toBe(false);
    expect(stress.run["labels sha256"]).toHaveLength(12);
    expect(stress.run.seed).toBe(run.find((r) => r.item === "seed")!.value);
    expect(stressState(stress, exec.platform!.score)).toBe("current");
  });
});

describe("unknown input", () => {
  test("unknown rule, account and scenario give null", async () => {
    expect(await getRule("Trades", "NO_SUCH_RULE", {})).toBeNull();
    expect(await getRule("Prices", "TXN_DUPLICATE", {})).toBeNull(); // a rule is a domain and a rule together
    expect(await getAccount("NOPE123", {})).toBeNull();
    expect(await getScenario("no such scenario", {})).toBeNull();
  });

  test("page 999 is clamped to the last page", async () => {
    const rule = (await getRule("Trades", "TXN_AFTER_CUTOFF", { page: 999 }))!.records;
    expect(rule.page).toBe(Math.max(rule.pages, 1));
    expect(rule.pages).toBe(Math.ceil(rule.total / PAGE_SIZE));
    expect(rule.rows.length).toBeGreaterThan(0);
    const [a] = await csv("02_account_outcomes.csv", "ORDER BY account_id LIMIT 1");
    expect((await getAccount(a.account_id!, { page: 999 }))!.records.page).toBe(1);
    const [s] = await csv("02_impact_detail.csv", "ORDER BY scenario LIMIT 1");
    const scenario = (await getScenario(s.scenario!, { page: 999 }))!.records;
    expect(scenario.page).toBe(1);
    expect(scenario.rows.length).toBeGreaterThan(0);
  });

  test("a bogus result filter is ignored", async () => {
    const all = (await getRule("Trades", "TXN_AFTER_CUTOFF", {}))!.records;
    const bogus = (await getRule("Trades", "TXN_AFTER_CUTOFF", { result: parseResult("bogus") }))!.records;
    expect(bogus.total).toBe(all.total);
    expect(bogus.rows).toEqual(all.rows);
  });
});

describe("a store built before this change", () => {
  test("loads with the missing parts named and the account records from score_outcomes", async () => {
    const copy = await copyStore("store_before_executive.duckdb", async (con) => {
      for (const table of ["severity", "impact_detail", "account_outcomes"]) await con.run(`DROP TABLE ${table}`);
      await con.run("DROP TABLE stress_rates");
      await con.run("CREATE TABLE stress_rates (note VARCHAR)");
    });
    const [a] = await csv("02_scorecard_accounts.csv", "WHERE rank IS NOT NULL ORDER BY account_id LIMIT 1");
    const { old, account, scenario } = await onStore(copy, async () => ({
      old: await getExecutive(),
      account: await getAccount(a.account_id!, {}),
      scenario: await getScenario("anything", {}),
    }));
    expect(old.missing).toContain("impact");
    expect(old.missing).toContain("stress");
    expect(old.missing).not.toContain("scorecard");
    expect(old.stress).toBeNull();
    expect(old.scenarios).toEqual([]);
    expect(old.rules.length).toBe(exec.rules.length);
    expect(scenario).toBeNull();
    const rows = await csv("02_score_outcomes.csv", "WHERE account_id = $2", [a.account_id]);
    expect(account!.inherited).toBe(false);
    expect(account!.records.total).toBe(rows.length);
    expect(account!.records.rows.map((r) => `${r.test} ${r.recordId}`).sort())
      .toEqual(rows.map((r) => `${r.test} ${r.record_id}`).sort());
  });
});
