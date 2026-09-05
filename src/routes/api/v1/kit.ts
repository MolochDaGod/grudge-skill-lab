import { createFileRoute } from "@tanstack/react-router";
import { kitPayload } from "@/lib/grudge-kit";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
};

export const Route = createFileRoute("/api/v1/kit")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () => Response.json(kitPayload(), { headers: cors }),
    },
  },
});
