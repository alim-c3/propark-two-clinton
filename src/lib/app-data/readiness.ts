import { createServerFn } from "@tanstack/react-start";

export type ConnectorReadiness = { ready: boolean };

export const getConnectorReadiness = createServerFn({ method: "POST" }).handler(
  async (): Promise<ConnectorReadiness> => {
    const { assertProtectedEvalAccess } = await import("@/lib/eval/access.server");
    await assertProtectedEvalAccess();
    const { isConnectorTokenReady } = await import("./client.server.ts");
    return { ready: isConnectorTokenReady() };
  },
);
