import { createFileRoute, redirect } from "@tanstack/react-router";

// /admin is the owner's entry point. The directory itself still checks the
// admin session on the server.
export const Route = createFileRoute("/admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/evaluators" });
  },
});
