/** A deliberately small highlighter for previews: comments, strings, numbers and keywords. */
export type Token = { text: string; kind?: "comment" | "string" | "keyword" | "number" };

const KEYWORDS = new Set(
  (
    "abstract as async await break case catch class const continue def default delete do elif else enum export extends false finally for from " +
    "function if implements import in instanceof interface let new None not null of or pass private protected public raise readonly return " +
    "self static super switch this throw true try type typeof undefined var void while with yield and is lambda nonlocal global None True False fn pub mut impl struct use match"
  ).split(" "),
);

const PATTERN = /(\/\/.*$|#(?![!{\[]).*$|\/\*.*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d[\d_.]*\b|\b[A-Za-z_$][\w$]*\b)/g;

/** Tokens of one line. Multi line comments and strings are only caught within the line. */
export function highlightLine(line: string, language: string): Token[] {
  const hashComments = ["py", "sh", "yml", "yaml", "toml", "rb"].includes(language);
  const out: Token[] = [];
  let last = 0;
  for (const m of line.matchAll(PATTERN)) {
    const text = m[0];
    const at = m.index!;
    if (at > last) out.push({ text: line.slice(last, at) });
    let kind: Token["kind"];
    if (text.startsWith("//") || text.startsWith("/*")) kind = "comment";
    else if (text.startsWith("#")) kind = hashComments ? "comment" : undefined;
    else if (/^["'`]/.test(text)) kind = "string";
    else if (/^\d/.test(text)) kind = "number";
    else if (KEYWORDS.has(text)) kind = "keyword";
    out.push({ text, kind });
    last = at + text.length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}
