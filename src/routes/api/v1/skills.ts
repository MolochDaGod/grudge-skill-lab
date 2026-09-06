import { createFileRoute } from "@tanstack/react-router";
import { json, listSkills, preflight } from "@/lib/grudge-skills.server";

export const Route = createFileRoute("/api/v1/skills")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const weapon = url.searchParams.get("weapon") || undefined;
        const wired = url.searchParams.get("wired") || undefined;
        const saved = url.searchParams.get("saved") || undefined;
        try {
          return json(await listSkills({ weapon, wired, saved }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "skills failed";
          return json({ error: message }, 502);
        }
      },
    },
  },
});
