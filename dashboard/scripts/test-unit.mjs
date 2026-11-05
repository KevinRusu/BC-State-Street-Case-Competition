import { fixtureStore, prepareFixture, runNode } from "./test-fixture.mjs";

// Honor the existing tests/store_test.sh fixture when explicitly supplied.
if (!process.env.STORE_PATH) prepareFixture();
runNode("node_modules/vitest/vitest.mjs", ["run", ...process.argv.slice(2)], {
  ...process.env, STORE_PATH: process.env.STORE_PATH || fixtureStore,
});
