import "server-only"

import { neon } from "@neondatabase/serverless"
import { parseEnv } from "@neon/env"
import { drizzle } from "drizzle-orm/neon-http"

import config from "@/neon"
import * as schema from "./schema"

const { postgres } = parseEnv(config, ["DATABASE_URL"])

export const db = drizzle(neon(postgres.databaseUrl), { schema })
