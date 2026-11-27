import { describe, expect, test } from "bun:test";
import { assignRequirementCodes, nextRequirementCode, requirementCodeProblem, requirementLabel } from "./requirement-code";

describe("requirement codes", () => {
  test("the next code follows the highest number of its type and skips taken ones", () => {
    expect(nextRequirementCode("functional", [])).toBe("RF1");
    expect(nextRequirementCode("functional", ["RF1", "RF7", "RNF2", null])).toBe("RF8");
    expect(nextRequirementCode("non_functional", ["RF1", "RNF2"])).toBe("RNF3");
    expect(nextRequirementCode("functional", ["rf1", "LOGIN"])).toBe("RF2");
  });

  test("assigning keeps own codes, numbers the rest and fixes duplicates", () => {
    const out = assignRequirementCodes([
      { type: "functional" as const, code: null },
      { type: "non_functional" as const },
      { type: "functional" as const, code: "rf9" },
      { type: "functional" as const, code: "RF9" },
    ]);
    expect(out.map((r) => r.code)).toEqual(["RF10", "RNF1", "RF9", "RF11"]);
  });

  test("a typed code must be well formed and free", () => {
    expect(requirementCodeProblem("RF1", ["RF2"])).toBeNull();
    expect(requirementCodeProblem("login-2", [])).toBeNull();
    expect(requirementCodeProblem("rf2", ["RF2"])).toContain("Ya hay");
    expect(requirementCodeProblem("1RF", [])).not.toBeNull();
    expect(requirementCodeProblem("RF 1", [])).not.toBeNull();
    expect(requirementCodeProblem("  ", [])).toBe("Escribe un código");
  });

  test("label puts the code before the title", () => {
    expect(requirementLabel({ code: "RF3", title: "Pagos" })).toBe("RF3 Pagos");
    expect(requirementLabel({ code: null, title: "Pagos" })).toBe("Pagos");
  });
});
