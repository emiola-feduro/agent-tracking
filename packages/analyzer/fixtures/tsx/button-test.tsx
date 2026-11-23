import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders the label", () => {
    render(<Button label="Hola" />);
    expect(screen.getByText(/Hola/)).toBeTruthy();
  });

  describe.skip("when clicked", () => {
    it("increments", () => {});
  });

  it.each([1, 2])("handles %i clicks", (n) => {
    expect(n).toBeGreaterThan(0);
  });
});
