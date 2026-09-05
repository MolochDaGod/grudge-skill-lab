import { createFileRoute } from "@tanstack/react-router";
import { getSkill, json, preflight, putSkill } from "@/lib/grudge-skills.server";

export const Route = createFileRoute("/api/v1/skills/$id")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ params }) => {
        try {
          const skill = await getSkill(params.id);
          if (!skill) return json({ error: "not found", id: params.id }, 404);
          return json(skill);
        } catch (error) {
          const message = error instanceof Error ? error.message : "skill failed";
          return json({ error: message }, 502);
        }
      },
      PUT: async ({ params, request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          if (!body || typeof body !== "object") {
            return json({ error: "JSON body required" }, 400);
          }
          const saved = await putSkill(params.id, body);
          return json(saved);
        } catch (error) {
          const message = error instanceof Error ? error.message : "save failed";
          return json({ error: message }, 400);
        }
      },
    },
  },
});
