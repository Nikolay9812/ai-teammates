import { withSentryConfig } from "@sentry/nextjs/config"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: false,
}

export default withSentryConfig(nextConfig, {
  org: "codewithantonio-hg",
  project: "ai-teammates",

  // Source map upload auth token
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a wider set of client source files for better stack trace resolution
  widenClientFileUpload: true,

  // Proxy browser events through the app to bypass ad-blockers
  tunnelRoute: "/monitoring",

  // Suppress non-CI output
  silent: !process.env.CI,
})
