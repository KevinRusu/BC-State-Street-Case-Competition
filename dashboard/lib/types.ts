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
  /** Is the register the store copied still the one on disk? (lib/store.ts registerState) */
  registerState: "current" | "stale" | "missing";
  registerChecksumNow: string;
  /** Where the trace's finding marks come from: every record a line counts, or (older stores) its examples only. */
  memberSource: "members" | "examples";
};

/** A row of the map: an office, or the strip of independent sources. */
export type MapOffice = { id: string; label: string; kind: "office" | "independent"; x: number; y: number; w: number; h: number };

/** A column of the map: a stage of the flow. `note` is the bracket text over it, if any. */
export type MapStage = { id: string; label: string; note: string; x: number; w: number };

/** A "comes from" chip: `data` when the data names the source (its distinct values), `reasoning` when it is ours. */
export type MapSource = { label: string; evidence: "data" | "reasoning"; column: string; values: string[]; reason: string };

export type MapNode = {
  id: string;
  label: string;
  office: string;
  stage: string;
  /** Where it sits, in words: "Middle office · Positions". */
  place: string;
  check: string;
  owner: string;
  checkOffice: string;
  x: number;
  y: number;
  grain: string;
  note: string;
  rows: number;
  manifestRows: number;
  columns: number;
  unreadableDates: string;
  rules: string[];
  sources: MapSource[];
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
  /** The check a handoff carries, with its owner and office ("" on other edges). */
  check: string;
  owner: string;
  checkOffice: string;
  /** The side a line leaves and enters: top|right|bottom|left, -a / -b for 30 % / 70 % along it. */
  fromHandle: string;
  toHandle: string;
  /** Where the line's small tag sits (0-1 along it) and which way it extends. */
  tagAt: number;
  tagSide: "left" | "right" | "above" | "below";
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
  /** The one map element this line counts on (build_store.py decides). */
  mapKind: "node" | "edge" | "";
  mapId: string;
};

export type RuleText = { ruleId: string; section: string; test: string; onFail: string; note: string };

export type ColumnDoc = { table: string; column: string; intendedType: string; description: string };

export type MapData = {
  info: StoreInfo;
  offices: MapOffice[];
  stages: MapStage[];
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

export type RegisterMark = {
  line: number;
  ruleId: string;
  finding: string;
  status: string;
  recordId: string;
  idKind: string;
  /** Location assigned by the Python store builder, not inferred from a finding's wording. */
  mapKind: "node" | "edge" | "";
  mapId: string;
};

export type TraceResult =
  | { found: false; query: string }
  | { found: true; query: string; kind: string; summary: string; hops: Hop[]; marks: RegisterMark[] };

export type DemoTrace = { position: number; recordId: string; label: string; status: string; source: string };
