import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const dashboard = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const root = path.resolve(dashboard, "..");
export const fixtureStore = path.join(root, "tests/runs/dashboard_fixture/store.duckdb");
export const browserFixtureStore = path.join(root, "tests/runs/dashboard_browser_fixture/store.duckdb");

export function prepareFixture(store = fixtureStore) {
  const python = process.env.DASHBOARD_TEST_PYTHON;
  const args = ["tests/prepare_dashboard_fixture.py", "--output", path.dirname(store)];
  const result = spawnSync(python || "uv", python
    ? ["-X", "utf8", ...args]
    : ["run", "--quiet", "python", "-X", "utf8", ...args], {
    cwd: root, stdio: "inherit", windowsHide: true, env: { ...process.env, PYTHONUTF8: "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Dashboard fixture preparation failed (${result.status})`);
}

export function runNode(script, args = [], env = process.env) {
  const result = spawnSync(process.execPath, [path.join(dashboard, script), ...args], {
    cwd: dashboard, stdio: "inherit", windowsHide: true, env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed (${result.status})`);
}
