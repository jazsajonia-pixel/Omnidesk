import { app } from "../src/server/app.js";

/**
 * Vercel Node.js function. All /api/* paths are rewritten here (see vercel.json)
 * and handled by the Hono app using Web-standard Request/Response objects.
 */
const handler = (request: Request) => app.fetch(request);

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;
