import { createServerFn } from "@tanstack/react-start";
import { siteModeFromHost, type SiteMode } from "@/lib/portfolio";

export const getSiteMode = createServerFn({ method: "GET" }).handler(async (): Promise<SiteMode> => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const host = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host") ?? "";
  return siteModeFromHost(host);
});
