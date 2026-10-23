// Shapes of what lib/store.ts reads from outputs/store.duckdb (built by scripts/build_store.py).

export type Status = "orphans" | "fan_out" | "blank_keys" | "ok" | "info";
export type HopStatus = "ok" | "fan_out" | "missing" | "info" | "not_reached";

export type StoreInfo = {
  builtAt: string;
  snapshotDate: string;
  manifest: string;
  manifestChecksum: string;
  registerChecksum: string;
  registerLines: number;
};

export type Band = { id: string; label: string; subtitle: string; x: number; y: number; w: number; h: number };

export type MapNode = {
  id: string;
  label: string;
  band: string;
  stage: string;
  x: number;
  y: number;
  grain: string;
  note: string;
  rows: number;
  manifestRows: number;
  columns: number;
  unreadableDates: string;
  rules: string[];
};

export type EdgeKind = "handoff" | "flow" | "lookup";

export type MapEdge = {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  handoff: number | null;
  label: string;
  expected: string;
  inferred: boolean;
  status: Status;
  rules: string[];
};

export type JoinSide = {
  edgeId: string;
  joinId: string;
  joinLabel: string;
  side: "left" | "right";
  table: string;
  keys: string;
  filter: string;
  required: boolean;
  uniqueExpected: boolean;
  observedCardinality: string;
  status: Status;
  rows: number;
  blankKeyRows: number;
  distinctKeys: number;
  maxRowsPerKey: number;
  repeatedKeys: number;
  orphanKeys: number;
  orphanRows: number;
  sampleOrphans: string;
  sampleRepeated: string;
};

export type RegisterLine = {
  line: number;
  ruleId: string;
  finding: string;
  status: string;
  stage: string;
  unit: string;
  affected: number;
  eligible: number;
  notEvaluable: number;
  examples: string;
  idKind: string;
};

export type RuleText = { ruleId: string; section: string; test: string; onFail: string; note: string };

export type ColumnDoc = { table: string; column: string; intendedType: string; description: string };

export type MapData = {
  info: StoreInfo;
  bands: Band[];
  nodes: MapNode[];
  edges: MapEdge[];
  health: JoinSide[];
  register: RegisterLine[];
  catalog: RuleText[];
  columns: ColumnDoc[];
};

export type Row = Record<string, string | null>;

export type Hop = {
  id: string;
  title: string;
  table: string;
  edge: string | null;
  via: string;
  expected: "one" | "one_or_more" | "any";
  total: number;
  columns: string[];
  rows: Row[];
  status: HopStatus;
  note: string;
};

export type RegisterMark = { line: number; ruleId: string; finding: string; status: string; recordId: string };

export type TraceResult =
  | { found: false; query: string }
  | { found: true; query: string; kind: string; summary: string; hops: Hop[]; marks: RegisterMark[] };

export type DemoTrace = { position: number; recordId: string; label: string; status: string; source: string };
