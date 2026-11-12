// The shapes the executive view reads from the store (lib/store.ts) and places on its pages. Types only.
// A `Num` of null is a blank in the outputs: it is shown as a dash, "not priced", "not computed" or "not applicable",
// never as 0.

export type Num = number | null;

/** A score with the two values the brief requires beside it: its coverage and its confirmed-only score. */
export type ScoreTrio = { score: Num; coverage: Num; confirmedOnly: Num };

/** The optional target is a minimum published on the domain-score scale. */
export type DomainScore = ScoreTrio & { domain: string; owner: string; target: Num };

/** One test of a rule. Counts exist at test level only, each in the test's own unit kind. */
export type TestScore = ScoreTrio & {
  test: string; unitKind: string; population: Num; evaluable: Num; passed: Num;
  failedConfirmed: Num; failedUnresolved: Num; cleared: Num; notEvaluable: Num;
};

/** A rule is identified by its domain and rule ID together: one rule can sit in two domains. */
export type RuleScore = ScoreTrio & {
  domain: string; rule: string; name: string; owner: string; whatItTests: string; onFail: string; tests: TestScore[];
};

/** What happened to a listed unit. Plain passes are counted in the scorecard, never listed. */
export type Result = "confirmed fail" | "unresolved fail" | "not evaluable" | "cleared";

export type OutcomeRecord = {
  domain: string; rule: string; test: string; unitKind: string; recordId: string;
  /** The accounts the unit names, sorted: several only for a transaction_id unit on a rule page. */
  accounts: string[];
  holding: string; securityId: string; result: Result; finding: string; plain: string;
};

export type RecordFilter = { result?: Result; finding?: string; domain?: string; page?: number };

export type RecordPage = {
  total: number; page: number; pages: number; counts: Record<Result, number>;
  findings: { finding: string; plain: string; rows: number }[]; domains: string[]; rows: OutcomeRecord[];
};

export type SeriesPoint = { start: string; value: Num; threshold: Num; breach: boolean };
export type IndicatorSeries = { key: string; period: string; points: SeriesPoint[] };

/** How many lagging keys a leading indicator flagged earlier: a look-back, not predictive accuracy. */
export type Lookback = {
  lagging: string; laggingKeys: Num; flaggedEarlier: Num; misses: Num; shareFlaggedEarlier: Num;
  earliestLeadDays: Num; medianLeadDays: Num; verdict: string;
};

export type Indicator = {
  id: string; name: string; type: string; status: string; threshold: string; owner: string; refresh: string;
  inputsNeeded: string; value: Num; unit: string; breaches: Num; firstBreach: string;
  series: IndicatorSeries[]; lookback: Lookback[];
};

export type Kpi = {
  n: string; office: string; kpi: string; formula: string; unit: string; owner: string; target: string;
  value: Num; met: string; status: string;
};

/** An account's per-domain scores carry coverage only (spec §5.2). */
export type AccountScore = ScoreTrio & {
  accountId: string; inMaster: boolean; fundId: string; shareClass: string; rank: Num; navProximity: Num;
  weakestLink: Num; domains: { domain: string; score: Num; coverage: Num }[]; fundNavResult: string;
};

/** The lowest-ranked accounts; `tiedBeyond` counts accounts past the cut that share the last row's score. */
export type WorstAccounts = { rows: AccountScore[]; scored: number; tiedBeyond: number };

/** One impact scenario of `02_severity.csv`. Scenarios overlap and are never added up. */
export type Scenario = {
  scenario: string; interpretation: string; evidence: string; accountScope: string; financialRows: Num;
  valuedRows: Num; unknownRows: Num; valuationCoverage: Num; signedUsd: Num; grossUsd: Num; maxFundNetBps: Num;
  distinctAccounts: Num; affectedFunds: Num;
};

export type ImpactRecord = {
  accountId: string; securityId: string; fundId: string; deltaUnits: Num; deltaUsd: Num; valuationReason: string;
  ledgerId: string;
};

export type ImpactPage = { total: number; page: number; pages: number; priced: number; notPriced: number; rows: ImpactRecord[] };

/** A sensitivity variant: an alternative next to the main score it varies, not a score of its own. */
export type Sensitivity = {
  variant: string; level: string; name: string; score: Num; mainScore: Num; change: Num; worstN: Num;
  worstNKept: Num; tiesAtCutoff: Num; rankCorrelation: Num;
};

export type StressRate = { role: string; level: string; cases: Num; share: Num; drawn: Num; wanted: Num };
export type StressMeasure = { measure: string; before: Num; after: Num };
export type Stress = { rates: StressRate[]; measures: StressMeasure[]; run: Record<string, string> };

/** A part of the page whose table the store lacks (built before this change, or its CSV was missing). */
export type Part = "scorecard" | "indicators" | "kpis" | "accounts" | "impact" | "sensitivity" | "stress";

export type ExecutiveData = {
  platform: ScoreTrio | null; domains: DomainScore[]; rules: RuleScore[]; indicators: Indicator[]; kpis: Kpi[];
  worst: WorstAccounts; scenarios: Scenario[]; sensitivity: Sensitivity[]; stress: Stress | null; missing: Part[];
};
