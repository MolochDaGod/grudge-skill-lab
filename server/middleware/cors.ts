/**
 * Open CORS for the skill/kit API and Grok preview iframe.
 * Runs on every Nitro request so PUT /api/v1/skills from Warlords clients works.
 */
const ALLOW_HEADERS = "Content-Type, Authorization, Accept, X-Requested-With";
const ALLOW_METHODS = "GET, HEAD, PUT, POST, OPTIONS";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && origin !== "null" ? origin : "*",
    Vary: "Origin",
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
  };
}

type CorsEvent = {
  url: URL;
  req: { method: string; headers: Headers };
};

export default async function corsMiddleware(
  event: CorsEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const origin = event.req.headers.get("origin");
  const headers = corsHeaders(origin);
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  const result = await next();
  if (!(result instanceof Response)) return result;
  const nextHeaders = new Headers(result.headers);
  for (const [key, value] of Object.entries(headers)) {
    if (!nextHeaders.has(key)) nextHeaders.set(key, value);
  }
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers: nextHeaders,
  });
}
