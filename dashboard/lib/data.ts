// What pages call. Every read waits for a real request (the store changes outside Next.js, so nothing is
// prerendered or cached) and a missing store becomes a friendly page instead of an error.
import { headers } from "next/headers";
import { connection } from "next/server";
import * as executive from "./executive-store";
import type { RecordFilter } from "./executive-types";
import { assertAuthorized } from "./hosting";
import * as store from "./store";

export type Loaded<T> = { ok: true; data: T } | { ok: false; file: string };

async function load<T>(read: () => Promise<T>): Promise<Loaded<T>> {
  await connection();
  // The second password check (the first is proxy.ts): a request that slipped past the proxy still reads no data.
  assertAuthorized((await headers()).get("authorization"));
  try {
    return { ok: true, data: await read() };
  } catch (error) {
    if (error instanceof store.StoreMissingError) return { ok: false, file: error.file };
    throw error;
  }
}

export const loadMap = () => load(store.getMapData);
export const loadStoreInfo = () => load(store.getStoreInfo);
export const loadDemoTraces = () => load(store.getDemoTraces);
export const loadTrace = (id: string) => load(() => store.traceRecord(id));
export const loadExecutive = () => load(executive.getExecutive);
export const loadRule = (domain: string, rule: string, filter: RecordFilter) =>
  load(() => executive.getRule(domain, rule, filter));
export const loadAccount = (id: string, filter: RecordFilter) => load(() => executive.getAccount(id, filter));
export const loadScenario = (name: string, filter: { priced?: "yes" | "no"; page?: number }) =>
  load(() => executive.getScenario(name, filter));
