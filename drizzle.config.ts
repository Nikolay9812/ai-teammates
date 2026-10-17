import { loadEnvConfig } from "@next/env"
import { parseEnv } from "@neon/env"
import { defineConfig } from "drizzle-kit"

import config from "./neon"

loadEnvConfig(process.cwd())

// Schema pushes use the direct (unpooled) connection.
const { postgres } = parseEnv(config, ["DATABASE_URL_UNPOOLED"])

export default defineConfig({
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: postgres.databaseUrlUnpooled },
})
