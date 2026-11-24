import { useMemo } from "react";
import type { ProjectView, TestCase } from "@/lib/api";
import { TEST_TYPE_LABEL } from "@/lib/labels";

export type TestGrouping = "type" | "feature" | "requirement";
export type TestGroup = { key: string; label: string; tests: TestCase[] };

const UNASSIGNED = "";

/** Groups the project's tests by type, feature or requirement, in a stable order. */
const useTestGroups = (view: ProjectView, by: TestGrouping): TestGroup[] => {
  const { tests, features, requirements } = view;

  return useMemo(() => {
    const keyOf = (t: TestCase) => (by === "type" ? t.type : by === "feature" ? (t.featureId ?? UNASSIGNED) : (t.requirementId ?? UNASSIGNED));
    const order =
      by === "type"
        ? Object.keys(TEST_TYPE_LABEL)
        : by === "feature"
          ? features.map((f) => f.id)
          : requirements.map((r) => r.id);
    const names = new Map<string, string>(
      by === "type"
        ? Object.entries(TEST_TYPE_LABEL)
        : by === "feature"
          ? features.map((f) => [f.id, f.name])
          : requirements.map((r) => [r.id, r.title]),
    );
    const groups = new Map<string, TestCase[]>();
    for (const t of tests) groups.set(keyOf(t), [...(groups.get(keyOf(t)) ?? []), t]);
    const rank = (key: string) => (key === UNASSIGNED ? Number.MAX_SAFE_INTEGER : order.indexOf(key));
    return [...groups.entries()]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([key, list]) => ({
        key,
        label: key === UNASSIGNED ? (by === "feature" ? "Sin feature" : "Sin requerimiento") : (names.get(key) ?? key),
        tests: [...list].sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name)),
      }));
  }, [tests, features, requirements, by]);
};

export default useTestGroups;
