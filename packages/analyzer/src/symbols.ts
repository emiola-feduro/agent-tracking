import type { Node } from "web-tree-sitter";
import type { CodeSymbol, SymbolKind } from "./types";

const lines = (n: Node) => ({ startLine: n.startPosition.row + 1, endLine: n.endPosition.row + 1 });
const named = (n: Node) => n.namedChildren.filter((c): c is Node => c !== null);
const isAsync = (n: Node) => n.children.some((c) => c?.type === "async");

/** Removes the quotes of a JS/Python string literal node (templates without substitutions included). */
export function stringValue(n: Node | null | undefined): string | null {
  if (!n) return null;
  if (n.type === "string" || n.type === "template_string") {
    if (named(n).some((c) => c.type === "template_substitution" || c.type === "interpolation")) {
      // Keep the literal shape so the name stays readable: `adds ${n}`.
      return n.text.slice(1, -1);
    }
    const parts = named(n).filter((c) => c.type === "string_fragment" || c.type === "string_content" || c.type === "escape_sequence");
    return parts.map((p) => p.text).join("");
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// TypeScript / JavaScript
// ---------------------------------------------------------------------------------------------

const FUNCTION_VALUES = new Set(["arrow_function", "function_expression", "function", "generator_function"]);

function jsClassMembers(body: Node | null, classExported: boolean): CodeSymbol[] {
  if (!body) return [];
  const out: CodeSymbol[] = [];
  for (const m of named(body)) {
    const nameNode = m.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) continue;
    const isPrivate = nameNode!.type === "private_property_identifier" || m.children.some((c) => c?.type === "accessibility_modifier" && c.text === "private");
    const exported = classExported && !isPrivate;
    if (m.type === "method_definition" || m.type === "abstract_method_signature" || m.type === "method_signature") {
      out.push({ name, kind: "method", ...lines(m), exported, ...(isPrivate ? { private: true } : {}), ...(isAsync(m) ? { async: true } : {}) });
    } else if (m.type === "public_field_definition" || m.type === "field_definition") {
      // Arrow-function fields behave like methods: `handle = () => {}`.
      const value = m.childForFieldName("value");
      if (value && FUNCTION_VALUES.has(value.type)) {
        out.push({ name, kind: "method", ...lines(m), exported, ...(isPrivate ? { private: true } : {}), ...(isAsync(value) ? { async: true } : {}) });
      }
    }
  }
  return out;
}

/** Symbols for one declaration node (the inner `declaration` of an export, or a top-level statement). */
function jsDeclaration(decl: Node, exported: boolean, outer: Node = decl): CodeSymbol[] {
  const name = decl.childForFieldName("name")?.text;
  const base = { ...lines(outer), exported };
  switch (decl.type) {
    case "function_declaration":
    case "generator_function_declaration":
    case "function_signature":
      return name ? [{ name, kind: "function", ...base, ...(isAsync(decl) ? { async: true } : {}) }] : [];
    case "class_declaration":
    case "abstract_class_declaration":
    case "class":
      return name ? [{ name, kind: "class", ...base, children: jsClassMembers(decl.childForFieldName("body"), exported) }] : [];
    case "interface_declaration":
      return name ? [{ name, kind: "interface", ...base }] : [];
    case "type_alias_declaration":
      return name ? [{ name, kind: "type", ...base }] : [];
    case "enum_declaration":
      return name ? [{ name, kind: "enum", ...base }] : [];
    case "lexical_declaration":
    case "variable_declaration": {
      const isConst = decl.children.some((c) => c?.type === "const");
      const out: CodeSymbol[] = [];
      for (const d of named(decl).filter((c) => c.type === "variable_declarator")) {
        const target = d.childForFieldName("name");
        const value = d.childForFieldName("value");
        // Destructuring declares every identifier in the pattern.
        const ids = target?.type === "identifier" ? [target] : (target?.descendantsOfType(["identifier", "shorthand_property_identifier_pattern"]) ?? []);
        for (const id of ids) {
          if (!id) continue;
          const fn = value && FUNCTION_VALUES.has(value.type);
          const kind: SymbolKind = fn ? "function" : isConst ? "constant" : "variable";
          const range = decl === outer && named(decl).length > 1 ? lines(d) : lines(outer);
          out.push({ name: id.text, kind, ...range, exported, ...(fn && isAsync(value) ? { async: true } : {}) });
        }
      }
      return out;
    }
    case "ambient_declaration": // declare function / class / const …
    case "internal_module": // namespace — only its name matters at top level
      return decl.type === "internal_module"
        ? name ? [{ name, kind: "variable", ...base }] : []
        : named(decl).flatMap((d) => jsDeclaration(d, exported, outer));
    default:
      return [];
  }
}

export function jsSymbols(root: Node): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const reexported = new Set<string>();
  let defaultName: string | null = null;

  for (const stmt of named(root)) {
    if (stmt.type === "export_statement") {
      const isDefault = stmt.children.some((c) => c?.type === "default");
      const decl = stmt.childForFieldName("declaration");
      const value = stmt.childForFieldName("value");
      if (decl) {
        for (const s of jsDeclaration(decl, true, stmt)) symbols.push(isDefault ? { ...s, isDefault: true } : s);
      } else if (isDefault && value) {
        if (value.type === "identifier") defaultName = value.text;
        else {
          const fromValue = jsDeclaration(value, true, stmt);
          if (fromValue.length) symbols.push(...fromValue.map((s) => ({ ...s, isDefault: true })));
          else {
            const kind: SymbolKind = value.type === "class" ? "class" : FUNCTION_VALUES.has(value.type) ? "function" : "constant";
            const children = value.type === "class" ? jsClassMembers(value.childForFieldName("body"), true) : undefined;
            symbols.push({ name: "default", kind, ...lines(stmt), exported: true, isDefault: true, ...(children ? { children } : {}) });
          }
        }
      } else if (!stmt.childForFieldName("source")) {
        // `export { a, b as c }` marks local declarations as exported.
        for (const spec of stmt.descendantsOfType("export_specifier")) {
          const n = spec?.childForFieldName("name")?.text;
          if (n) reexported.add(n);
        }
      }
    } else if (stmt.type === "expression_statement") {
      // CommonJS: module.exports = { a, b } / module.exports.x = … / exports.x = …
      const assign = named(stmt)[0];
      if (assign?.type !== "assignment_expression") continue;
      const left = assign.childForFieldName("left")?.text ?? "";
      const right = assign.childForFieldName("right");
      const m = left.match(/^(?:module\.)?exports\.([A-Za-z_$][\w$]*)$/);
      if (m) {
        const kind: SymbolKind = right && FUNCTION_VALUES.has(right.type) ? "function" : right?.type === "class" ? "class" : "constant";
        symbols.push({ name: m[1]!, kind, ...lines(stmt), exported: true });
      } else if (left === "module.exports" && right) {
        if (right.type === "identifier") reexported.add(right.text);
        for (const p of right.type === "object" ? named(right) : []) {
          if (p.type === "shorthand_property_identifier") reexported.add(p.text);
          if (p.type === "pair" && p.childForFieldName("value")?.type === "identifier") reexported.add(p.childForFieldName("value")!.text);
        }
      }
    } else {
      symbols.push(...jsDeclaration(stmt, false));
    }
  }

  return symbols.map((s) => {
    if (s.exported) return s;
    const isDefault = s.name === defaultName;
    if (!reexported.has(s.name) && !isDefault) return s;
    return {
      ...s,
      exported: true,
      ...(isDefault ? { isDefault: true } : {}),
      ...(s.children ? { children: jsClassMembersExported(s.children) } : {}),
    };
  });
}

/** Re-marks members as exported when their class gets exported later (`export { A }`), except private ones. */
const jsClassMembersExported = (members: CodeSymbol[]) => members.map((c) => (c.private ? c : { ...c, exported: true }));

/** Static and dynamic imports, `require()` calls and `export … from` sources. */
export function jsImports(root: Node): string[] {
  const out = new Set<string>();
  for (const n of root.descendantsOfType(["import_statement", "export_statement", "call_expression"])) {
    if (!n) continue;
    if (n.type === "call_expression") {
      const fn = n.childForFieldName("function");
      if (fn?.type !== "import" && fn?.text !== "require") continue;
      const arg = named(n.childForFieldName("arguments") ?? n)[0];
      const v = stringValue(arg);
      if (v) out.add(v);
    } else {
      const v = stringValue(n.childForFieldName("source"));
      if (v) out.add(v);
    }
  }
  return [...out];
}

// ---------------------------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------------------------

const isPublic = (name: string) => !name.startsWith("_") || (name.startsWith("__") && name.endsWith("__"));
const isConstantName = (name: string) => /^[A-Z][A-Z0-9_]*$/.test(name);

/** `(definition node, outer node incl. decorators)` */
function pyUnwrap(n: Node): [Node, Node] {
  return n.type === "decorated_definition" ? [n.childForFieldName("definition") ?? n, n] : [n, n];
}

function pyAssignmentTargets(stmt: Node): Node[] {
  const assign = named(stmt)[0];
  if (assign?.type !== "assignment") return [];
  const left = assign.childForFieldName("left");
  if (!left) return [];
  return left.type === "identifier" ? [left] : named(left).filter((c) => c.type === "identifier");
}

export function pySymbols(root: Node): CodeSymbol[] {
  // `__all__ = [...]` overrides the underscore convention when present.
  let all: Set<string> | null = null;
  for (const stmt of named(root)) {
    if (stmt.type !== "expression_statement") continue;
    const assign = named(stmt)[0];
    if (assign?.type === "assignment" && assign.childForFieldName("left")?.text === "__all__") {
      const right = assign.childForFieldName("right");
      all = new Set(named(right ?? assign).map(stringValue).filter((v): v is string => v !== null));
    }
  }
  const exported = (name: string) => (all ? all.has(name) : isPublic(name));

  const symbols: CodeSymbol[] = [];
  for (const stmt of named(root)) {
    const [def, outer] = pyUnwrap(stmt);
    const name = def.childForFieldName("name")?.text;
    if (def.type === "function_definition" && name) {
      symbols.push({ name, kind: "function", ...lines(outer), exported: exported(name), ...(isAsync(def) ? { async: true } : {}) });
    } else if (def.type === "class_definition" && name) {
      const isExported = exported(name);
      const children: CodeSymbol[] = [];
      for (const member of named(def.childForFieldName("body") ?? def)) {
        const [m, mOuter] = pyUnwrap(member);
        const mName = m.childForFieldName("name")?.text;
        if (m.type === "function_definition" && mName) {
          children.push({ name: mName, kind: "method", ...lines(mOuter), exported: isExported && isPublic(mName), ...(isPublic(mName) ? {} : { private: true }), ...(isAsync(m) ? { async: true } : {}) });
        }
      }
      symbols.push({ name, kind: "class", ...lines(outer), exported: isExported, children });
    } else if (stmt.type === "type_alias_statement") {
      const left = stmt.childForFieldName("left");
      const id = left?.descendantsOfType("identifier")[0];
      if (id) symbols.push({ name: id.text, kind: "type", ...lines(stmt), exported: exported(id.text) });
    } else if (stmt.type === "expression_statement") {
      for (const id of pyAssignmentTargets(stmt)) {
        if (id.text === "__all__") continue;
        symbols.push({ name: id.text, kind: isConstantName(id.text) ? "constant" : "variable", ...lines(stmt), exported: exported(id.text) });
      }
    }
  }
  return symbols;
}

/** Imported module names; relative imports keep their leading dots (`.models`). */
export function pyImports(root: Node): string[] {
  const out = new Set<string>();
  for (const n of root.descendantsOfType(["import_statement", "import_from_statement"])) {
    if (!n) continue;
    if (n.type === "import_from_statement") {
      const mod = n.childForFieldName("module_name");
      if (mod) out.add(mod.text);
    } else {
      for (const name of n.childrenForFieldName("name")) {
        if (!name) continue;
        out.add((name.type === "aliased_import" ? name.childForFieldName("name") : name)?.text ?? name.text);
      }
    }
  }
  return [...out];
}
