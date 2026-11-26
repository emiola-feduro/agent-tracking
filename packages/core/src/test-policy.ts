import { PROJECT_KIND_INFO, type ProjectKind } from "./project-kind";
import type { TestType } from "./types";

/**
 * The kinds of tests agents are expected to write in a project. Chosen in the wizard (with defaults
 * from the kind of project) and written into CONTEXT.md and each agent's instructions.
 */
export const TEST_POLICY_TYPES: { type: TestType; label: string; description: string }[] = [
  { type: "unit", label: "Unitarios", description: "Funciones y clases aisladas, rápidos y sin red ni base de datos" },
  { type: "integration", label: "Integración", description: "Varias piezas juntas: API con su base de datos, servicios entre sí" },
  { type: "component", label: "Componentes", description: "Componentes de interfaz renderizados con sus estados e interacciones" },
  { type: "e2e", label: "End to end", description: "Flujos completos como los usa una persona, en el navegador o el dispositivo" },
  { type: "contract", label: "Contrato", description: "Que la API cumple lo que esperan sus clientes (esquemas, respuestas)" },
  { type: "performance", label: "Rendimiento", description: "Tiempos de respuesta y carga en los caminos críticos" },
];

export const testTypeLabel = (type: TestType) => TEST_POLICY_TYPES.find((t) => t.type === type)?.label ?? type;

/** What a project of this kind usually needs: a UI adds component and end to end tests, a backend integration tests. */
export function defaultTestTypes(kind: ProjectKind): TestType[] {
  const info = PROJECT_KIND_INFO[kind];
  return ["unit", ...(info.server ? (["integration"] as const) : []), ...(info.ui ? (["component", "e2e"] as const) : [])];
}

/** Markdown for CONTEXT.md and the agents' instructions. */
export function testPolicyMarkdown(types: TestType[] | null | undefined): string[] {
  if (!types?.length) return [];
  return [
    "Los agentes escriben estos tipos de tests para lo que construyen, y los reportan con su resultado:",
    "",
    ...TEST_POLICY_TYPES.filter((t) => types.includes(t.type)).map((t) => `- **${t.label}:** ${t.description}.`),
  ];
}
