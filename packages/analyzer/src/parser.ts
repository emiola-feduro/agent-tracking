import { Language, Parser } from "web-tree-sitter";
// Imported as files so `bun build --compile` embeds them in the sidecar binary.
import coreWasm from "web-tree-sitter/web-tree-sitter.wasm" with { type: "file" };
import javascriptWasm from "tree-sitter-javascript/tree-sitter-javascript.wasm" with { type: "file" };
import pythonWasm from "tree-sitter-python/tree-sitter-python.wasm" with { type: "file" };
import tsxWasm from "tree-sitter-typescript/tree-sitter-tsx.wasm" with { type: "file" };
import typescriptWasm from "tree-sitter-typescript/tree-sitter-typescript.wasm" with { type: "file" };

export type LanguageId = "typescript" | "tsx" | "javascript" | "python";

const GRAMMARS: Record<LanguageId, string> = {
  typescript: typescriptWasm,
  tsx: tsxWasm,
  javascript: javascriptWasm,
  python: pythonWasm,
};

const EXTENSIONS: Record<string, LanguageId> = {
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  // The JavaScript grammar parses JSX natively.
  ".jsx": "javascript",
  ".py": "python",
  ".pyi": "python",
};

export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSIONS);

/** Language for a file path, or null if unsupported. */
export function detectLanguage(path: string): LanguageId | null {
  const m = path.toLowerCase().match(/\.[a-z]+$/);
  return m ? (EXTENSIONS[m[0]] ?? null) : null;
}

let ready: Promise<void> | undefined;
const languages = new Map<LanguageId, Promise<Language>>();
const parsers = new Map<LanguageId, Parser>();

/** Initializes the tree-sitter runtime once; reads the wasm ourselves so it also works from `$bunfs`. */
function init(): Promise<void> {
  ready ??= Bun.file(coreWasm)
    .bytes()
    .then((wasmBinary) => Parser.init({ wasmBinary } as object))
    .catch((err) => {
      ready = undefined;
      throw err;
    });
  return ready;
}

function loadLanguage(id: LanguageId): Promise<Language> {
  let lang = languages.get(id);
  if (!lang) {
    lang = init().then(async () => Language.load(await Bun.file(GRAMMARS[id]).bytes()));
    lang.catch(() => languages.delete(id));
    languages.set(id, lang);
  }
  return lang;
}

/** A parser configured for the language (one per language, reused; parsing is synchronous). */
export async function getParser(id: LanguageId): Promise<Parser> {
  const language = await loadLanguage(id);
  let parser = parsers.get(id);
  if (!parser) {
    parser = new Parser();
    parser.setLanguage(language);
    parsers.set(id, parser);
  }
  return parser;
}
