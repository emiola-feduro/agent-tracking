import type { ReactNode } from "react";

/**
 * A small Markdown preview for templates: headings, paragraphs, lists, task lists, inline code and
 * bold. HTML comments are shown as notes, since GitHub hides them from the rendered pull request.
 * Built from React elements, never from raw HTML.
 */
type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: { text: string; task?: boolean; done?: boolean }[] }
  | { type: "comment"; text: string }
  | { type: "code"; text: string }
  | { type: "paragraph"; text: string };

function parse(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("<!--")) {
      const body: string[] = [];
      let rest = line.trim().slice(4);
      for (;;) {
        const end = rest.indexOf("-->");
        if (end >= 0) {
          body.push(rest.slice(0, end));
          break;
        }
        body.push(rest);
        if (++i >= lines.length) break;
        rest = lines[i]!;
      }
      i++;
      blocks.push({ type: "comment", text: body.join("\n").trim() });
      continue;
    }
    if (line.startsWith("```")) {
      const body: string[] = [];
      while (++i < lines.length && !lines[i]!.startsWith("```")) body.push(lines[i]!);
      i++;
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2]! });
      i++;
      continue;
    }
    const item = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
    if (item.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: Extract<Block, { type: "list" }>["items"] = [];
      while (i < lines.length && item.test(lines[i]!)) {
        const text = item.exec(lines[i]!)![2]!;
        const task = /^\[([ xX])\]\s*(.*)$/.exec(text);
        items.push(task ? { text: task[2]!, task: true, done: task[1] !== " " } : { text });
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const body: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|```|<!--|\s*([-*+]|\d+[.)])\s)/.test(lines[i]!)) body.push(lines[i++]!.trim());
    blocks.push({ type: "paragraph", text: body.join(" ") });
  }
  return blocks;
}

/** `code` and **bold** inside a line. */
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1)
      return (
        <code key={i} className="rounded-sm bg-subtle px-1 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

const HEADING = ["text-xl", "text-lg", "text-base", "text-base", "text-sm", "text-sm"];

const MarkdownPreview = ({ source }: { source: string }) => {
  const blocks = parse(source);
  if (blocks.length === 0) return <p className="text-muted">Nada que mostrar todavía.</p>;

  return (
    <div className="flex flex-col gap-3 text-ink">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <p key={i} role="heading" aria-level={block.level} className={`font-semibold ${HEADING[block.level - 1]} ${block.level <= 2 ? "border-b border-line pb-1" : ""}`}>
                {inline(block.text)}
              </p>
            );
          case "comment":
            return (
              <p key={i} className="rounded-md border border-dashed border-line-strong px-3 py-2 text-sm whitespace-pre-line text-muted">
                <span className="font-medium">Nota oculta en GitHub: </span>
                {block.text}
              </p>
            );
          case "code":
            return (
              <pre key={i} className="overflow-x-auto rounded-md bg-subtle p-3 font-mono text-[0.8125rem]">
                {block.text}
              </pre>
            );
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List key={i} className={`flex flex-col gap-1 pl-5 ${block.ordered ? "list-decimal" : block.items.every((x) => x.task) ? "list-none pl-0" : "list-disc"}`}>
                {block.items.map((item, j) => (
                  <li key={j} className={item.task ? "flex items-baseline gap-2" : undefined}>
                    {item.task && <input type="checkbox" checked={item.done} readOnly disabled className="size-3.5 translate-y-0.5 accent-brand" />}
                    <span>{inline(item.text)}</span>
                  </li>
                ))}
              </List>
            );
          }
          default:
            return <p key={i}>{inline(block.text)}</p>;
        }
      })}
    </div>
  );
};

export default MarkdownPreview;
