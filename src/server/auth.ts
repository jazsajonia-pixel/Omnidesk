import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import { db } from "./db/client.js";
import { schema } from "./db/schema.js";
import { trustedOrigins } from "./origins.js";

export const auth = betterAuth({
  appName: "OmniDesk",
  database: db ? drizzleAdapter(db, { provider: "pg", schema }) : undefined,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
  trustedOrigins: trustedOrigins(),
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: process.env.NODE_ENV !== "test" && process.env.DISABLE_RATE_LIMIT !== "true",
    storage: db ? "database" : "memory",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
    },
  },
  advanced: { ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] } },
  plugins: [organization({ creatorRole: "owner", membershipLimit: 50 })],
});
