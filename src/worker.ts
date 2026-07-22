import type { Env } from "./env";
import { app } from "./router";
import { runScheduled } from "./sync/orchestrator";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) return app.fetch(req, env, ctx);
    // resto → assets estáticos (dash React); fallback index.html (SPA)
    const res = await env.ASSETS.fetch(req);
    if (res.status === 404) {
      return env.ASSETS.fetch(new Request(new URL("/", req.url), req));
    }
    return res;
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduled(env, event.cron));
  },
};
