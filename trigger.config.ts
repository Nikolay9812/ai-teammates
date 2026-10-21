import { defineConfig } from "@trigger.dev/sdk";
import { esbuildPlugin } from "@trigger.dev/build/extensions";
import { sentryEsbuildPlugin } from "@sentry/esbuild-plugin";

export default defineConfig({
  project: "proj_eunppbqqgcpqiktkiyyy",
  runtime: "node-24",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["trigger"],
  build: {
    // Tasks read the database through `@/db`, which imports "server-only"
    conditions: ["react-server"],
    extensions: [
      // Uploads source maps on deploy so task stack traces in Sentry are readable
      esbuildPlugin(
        sentryEsbuildPlugin({
          org: "codewithantonio-hg",
          project: "ai-teammates",
          authToken: process.env.SENTRY_AUTH_TOKEN,
        }),
        { placement: "last", target: "deploy" }
      ),
    ],
  },
});
