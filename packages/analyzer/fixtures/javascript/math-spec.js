// Jest globals, no imports: framework comes from package.json.
const request = require("supertest");

describe("math", () => {
  test("adds", () => {
    expect(1 + 1).toBe(2);
  });
  xit("skipped one", () => {});
  test.todo("later");
});

test("top level", async () => {});
