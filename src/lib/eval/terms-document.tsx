import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <strong key={key++} className="font-semibold">
        {match[1]}
      </strong>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function TermsDocument({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let skippedTitle = false;

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-3 list-disc space-y-1 pl-5">
        {list.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    if (line.trim() === "---") {
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-6 border-navy/15" />);
      continue;
    }
    if (line.startsWith("# ") && !skippedTitle) {
      skippedTitle = true;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={`h4-${blocks.length}`} className="mt-5 font-display text-lg">
          {inline(line.slice(4))}
        </h4>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="mt-7 font-display text-xl">
          {inline(line.slice(3))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="mt-6 font-display text-2xl">
          {inline(line.slice(2))}
        </h2>,
      );
      continue;
    }
    blocks.push(
      <p key={`p-${blocks.length}`} className="mt-3 text-sm leading-7">
        {inline(line)}
      </p>,
    );
  }
  flushList();

  return <div className="text-navy">{blocks}</div>;
}
