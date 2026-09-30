import { env } from "@/lib/env.server";
import { currentAgreement } from "./agreement";

export async function sendEvalEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ delivered: boolean; provider: string }> {
  const apiKey = env("RESEND_API_KEY");
  const from = env("RUNWAY_EVAL_FROM_EMAIL") ?? "Runway <noreply@runway.eval>";
  if (apiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html ?? `<pre>${input.text}</pre>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend failed (${res.status}): ${body.slice(0, 240)}`);
    }
    return { delivered: true, provider: "resend" };
  }
  console.info("[eval-email]", input.to, input.subject, "\n", input.text);
  return { delivered: false, provider: "log" };
}

export function otpEmailCopy(input: { email: string; code: string; verifyUrl: string }) {
  const agreement = currentAgreement();
  const text = [
    "Your Runway evaluation sign-in code:",
    "",
    input.code,
    "",
    "This code expires in 10 minutes and can be used once.",
    `Open: ${input.verifyUrl}`,
    "",
    `${agreement.name} ${agreement.version}`,
  ].join("\n");
  return {
    subject: "Your Runway evaluation code",
    text,
  };
}
