import { createFileRoute } from "@tanstack/react-router";
import { AbilityLab } from "@/components/ability-lab";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <AbilityLab />;
}
