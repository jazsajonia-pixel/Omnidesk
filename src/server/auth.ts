import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import { db } from "./db/client";
import { schema } from "./db/schema";

export const auth = betterAuth({
  database: db ? drizzleAdapter(db, { provider: "pg", schema }) : undefined,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
  trustedOrigins: [process.env.APP_ORIGIN ?? "http://localhost:5173"],
  plugins: [organization()],
});
