import path from "node:path";
import { spawn } from "node:child_process";
import { dashboard, browserFixtureStore, prepareFixture, runNode } from "./test-fixture.mjs";

prepareFixture(browserFixtureStore);
const env = {
  ...process.env, STORE_PATH: browserFixtureStore, NEXT_TELEMETRY_DISABLED: "1", DASHBOARD_DIST_DIR: ".next-tests",
};
// Exercise a production build without touching the .next folder of the running dashboard.
runNode("node_modules/next/dist/bin/next", ["build"], env);
const server = spawn(process.execPath, [path.join(dashboard, "node_modules/next/dist/bin/next"),
  "start", "-H", "127.0.0.1", "-p", process.env.DASHBOARD_TEST_PORT || "3100"], {
  cwd: dashboard, env, stdio: "inherit", windowsHide: true,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("error", (error) => { console.error(error); process.exit(1); });
server.on("exit", (code) => process.exit(code ?? 1));
