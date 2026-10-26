// What pages call. Every read waits for a real request (the store changes outside Next.js, so nothing is
// prerendered or cached) and a missing store becomes a friendly page instead of an error.
import { connection } from "next/server";
import * as store from "./store";

export type Loaded<T> = { ok: true; data: T } | { ok: false; file: string };

async function load<T>(read: () => Promise<T>): Promise<Loaded<T>> {
  await connection();
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
