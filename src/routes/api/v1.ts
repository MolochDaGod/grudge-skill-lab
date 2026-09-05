import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
};

export const Route = createFileRoute("/api/v1")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () =>
        Response.json(
          {
            contract: "grudge.skillApi/v2",
            note: "Warlords-era skill + kit API. PUT a skill to publish a visual recipe.",
            endpoints: {
              skills: "/api/v1/skills",
              skill: "/api/v1/skills/:id",
              kit: "/api/v1/kit",
            },
            query: {
              skills: "?weapon=SWORD&wired=1",
            },
          },
          { headers: cors },
        ),
    },
  },
});
