import { describe, expect, test } from "bun:test";
import { classifyRequirement, missingPlanFields, parseProjectPlan, parseRequirements, PLAN_MONOREPO_EXAMPLE, PLAN_TEMPLATE, REQUIREMENTS_TEMPLATE, settleClassification } from "./index";

describe("classifyRequirement", () => {
  test("quality words make it non functional, the rest is placed in the system", () => {
    expect(classifyRequirement("Responde en menos de 200 ms")).toMatchObject({ type: "non_functional", area: "performance" });
    expect(classifyRequirement("Solo el dueño ve sus gastos")).toMatchObject({ type: "non_functional", area: "security" });
    expect(classifyRequirement("Se puede usar solo con teclado")).toMatchObject({ type: "non_functional", area: "accessibility" });
    expect(classifyRequirement("Pantalla de lista de gastos")).toMatchObject({ type: "functional", area: "frontend" });
    expect(classifyRequirement("Registrar gastos", "POST /expenses")).toMatchObject({ type: "functional", area: "backend" });
    expect(classifyRequirement("Notificar por correo")).toMatchObject({ type: "functional", area: "integration" });
    // An API has no frontend: "mostrar" does not make it one.
    expect(classifyRequirement("Mostrar el total del mes", "", "api").area).not.toBe("frontend");
    expect(classifyRequirement("Asegurar que el total cuadre").type).toBe("functional");
  });

  test("a given half is kept and the other agrees with it", () => {
    expect(settleClassification({ type: "non_functional" }, "Registrar gastos")).toMatchObject({ type: "non_functional" });
    expect(settleClassification({ type: "non_functional" }, "Registrar gastos").area).not.toBe("backend");
    expect(settleClassification({ area: "security" }, "x")).toEqual({ type: "non_functional", area: "security" });
    expect(settleClassification({ type: "functional", area: "security" }, "Pantalla")).toEqual({ type: "functional", area: "frontend" });
  });
});

describe("parseRequirements", () => {
  test("markdown: one heading per requirement, tags, description and criteria", () => {
    const r = parseRequirements(`# Requerimientos de Gastos

## Registrar gastos [funcional, backend]
Con monto y categoría.

### Criterios de aceptación
- Un monto negativo devuelve 400
- Responde 201

## RNF-1: Responde en menos de 200 ms
- [ ] p95 menor a 200 ms

## Lista de gastos
Tipo: funcional
Área: frontend
**DoD:**
1. Muestra los gastos del mes
`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual([
      { title: "Registrar gastos", description: "Con monto y categoría.", type: "functional", area: "backend", dod: ["Un monto negativo devuelve 400", "Responde 201"] },
      { title: "Responde en menos de 200 ms", description: "", type: "non_functional", area: "performance", dod: ["p95 menor a 200 ms"] },
      { title: "Lista de gastos", description: "", type: "functional", area: "frontend", dod: ["Muestra los gastos del mes"] },
    ]);
  });

  test("json in English or Spanish keys", () => {
    const r = parseRequirements(
      JSON.stringify({
        requirements: [
          { titulo: "Exportar a CSV", tipo: "funcional", criterios: ["Descarga un .csv", { criterion: "Incluye cabeceras" }] },
          { title: "Cifrar contraseñas", dod: [] },
          "Solo un título",
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0]).toMatchObject({ title: "Exportar a CSV", type: "functional", dod: ["Descarga un .csv", "Incluye cabeceras"] });
    expect(r.value[1]).toMatchObject({ type: "non_functional", area: "security" });
    expect(r.value[2]!.title).toBe("Solo un título");
    expect(r.warnings.some((w) => w.includes("no tienen criterios"))).toBe(true);
  });

  test("bad input says why", () => {
    expect(parseRequirements("{nope")).toMatchObject({ ok: false });
    expect(parseRequirements("texto sin títulos")).toMatchObject({ ok: false });
    expect(parseRequirements(REQUIREMENTS_TEMPLATE)).toMatchObject({ ok: true });
  });
});

describe("parseProjectPlan", () => {
  test("the template is a complete plan", () => {
    const r = parseProjectPlan(PLAN_TEMPLATE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      name: "Mis gastos",
      kind: "api",
      platforms: ["web"],
      stack: ["TypeScript", "Bun", "Hono", "Drizzle ORM"],
      databases: ["PostgreSQL"],
      rules: ["Los montos se guardan en centavos.", "Cada gasto pertenece a una sola categoría."],
    });
    expect(r.value.goal).toContain("Registrar gastos personales");
    expect(r.value.requirements.map((x) => [x.title, x.type, x.area, x.dod.length])).toEqual([
      ["Registrar gastos", "functional", "backend", 2],
      ["Responde rápido", "non_functional", "performance", 1],
    ]);
    expect(missingPlanFields(r.value)).toEqual([]);
  });

  test("what is missing becomes questions for the person", () => {
    const r = parseProjectPlan("# Tienda\n\n## Requerimientos\n\n### Catálogo\n");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(missingPlanFields(r.value).map((m) => m.field)).toEqual(["kind", "goal", "dod"]);
    const full = parseProjectPlan("# App\nTipo: aplicación completa\n\n## Objetivo\nx\n## Requerimientos\n### A\n- [ ] b\n");
    expect(full.ok && missingPlanFields(full.value).map((m) => m.field)).toEqual(["platforms"]);
  });
});

describe("monorepo, test types and reply language in a plan", () => {
  test("the monorepo example has its pieces, tool, tests and language, and the project adds up its pieces", () => {
    const r = parseProjectPlan(PLAN_MONOREPO_EXAMPLE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
    expect(r.value).toMatchObject({
      structure: "monorepo",
      monorepoTool: "pnpm-workspaces",
      testTypes: ["unit", "integration", "e2e"],
      replyLanguage: "es",
      kind: "fullstack",
      platforms: ["mobile"],
      stack: ["TypeScript", "Hono", "Flutter", "Dart"],
    });
    expect(r.value.parts).toEqual([
      { id: "api", name: "API", kind: "api", path: "apps/api", platforms: [], stack: ["TypeScript", "Hono"] },
      { id: "movil", name: "Móvil", kind: "mobile", path: "apps/mobile", platforms: ["mobile"], stack: ["Flutter", "Dart"] },
    ]);
    expect(r.value.requirements[0]!.parts).toEqual(["api", "movil"]);
    expect(missingPlanFields(r.value)).toEqual([]);
  });

  test("json works too, with default folders and pieces referenced by folder", () => {
    const r = parseProjectPlan(
      JSON.stringify({
        nombre: "Tienda",
        objetivo: "Vender",
        estructura: "monorepo",
        piezas: [{ nombre: "Web", tipo: "frontend" }, { name: "Shared", kind: "library", stack: "TypeScript" }],
        tests: ["unit", "componentes"],
        idioma: "English",
        requerimientos: [{ titulo: "Catálogo", piezas: ["apps/web"], criterios: ["Lista productos"] }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.parts.map((p) => [p.id, p.path])).toEqual([
      ["web", "apps/web"],
      ["shared", "packages/shared"],
    ]);
    expect(r.value).toMatchObject({ kind: "frontend", testTypes: ["unit", "component"], replyLanguage: "en", monorepoTool: null });
    expect(r.value.requirements[0]!.parts).toEqual(["web"]);
  });

  test("no language is a choice; unknown values and pieces become warnings", () => {
    const r = parseProjectPlan(
      "# X\nTipo: cli\nIdioma: ninguno\nTests: unitarios, humo\n## Objetivo\ny\n## Requerimientos\n### Z\nPiezas: core\n- [ ] w\n",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ structure: "single", replyLanguage: null, testTypes: ["unit"], parts: [] });
    expect(r.value.requirements[0]!.parts).toBeUndefined();
    expect(r.warnings.some((w) => w.includes('"humo"'))).toBe(true);
    const unset = parseProjectPlan("# X\nTipo: cli\n## Objetivo\ny\n## Requerimientos\n### Z\n- [ ] w\n");
    expect(unset.ok && [unset.value.replyLanguage, unset.value.testTypes]).toEqual([undefined, null]);
  });

  test("a monorepo without pieces, or with pieces the wizard would reject, asks for them", () => {
    const empty = parseProjectPlan("# X\nEstructura: monorepo\n## Objetivo\ny\n## Requerimientos\n### Z\n- [ ] w\n");
    expect(empty.ok && missingPlanFields(empty.value).map((m) => m.field)).toEqual(["parts"]);
    const untyped = parseProjectPlan("# X\n## Objetivo\ny\n## Piezas\n### Api\nCarpeta: apps/api\n## Requerimientos\n### Z\n- [ ] w\n");
    expect(untyped.ok && untyped.value.structure).toBe("monorepo");
    expect(untyped.ok && missingPlanFields(untyped.value)[0]!.question).toContain("Api");
    const overlap = parseProjectPlan(
      "# X\n## Objetivo\ny\n## Piezas\n### A\nTipo: api\nCarpeta: apps\n### B\nTipo: fullstack\nCarpeta: apps/b\n## Requerimientos\n### Z\n- [ ] w\n",
    );
    const q = overlap.ok ? missingPlanFields(overlap.value).find((m) => m.field === "parts")!.question : "";
    expect(q).toContain("se cruza");
    expect(q).toContain("plataforma");
  });
});

describe("commit conventions", () => {
  test("defaults when none were set, the team's rules when they were", async () => {
    const { conventionsMarkdown } = await import("./index");
    const defaults = conventionsMarkdown(null).join("\n");
    expect(defaults).toContain("Conventional Commits por defecto");
    expect(defaults).toContain("`feat`");
    const own = conventionsMarkdown({ types: ["feat", "fix"], scope: "required", language: "en", custom: "- Referencia el ticket: JIRA-123" }).join("\n");
    expect(own).toContain("<tipo>(<alcance>): <descripción>");
    expect(own).toContain("en inglés");
    expect(own).not.toContain("`docs`");
    expect(own).toContain("Referencia el ticket: JIRA-123");
  });

  test("a plan can carry them", () => {
    const r = parseProjectPlan("# X\nTipo: cli\n## Objetivo\ny\n## Convenciones de commits\n- Mensajes en inglés\n- Un commit por feature\n## Requerimientos\n### Z\n- [ ] w\n");
    expect(r.ok && r.value.conventions).toBe("Mensajes en inglés\nUn commit por feature");
  });
});
