import { openDb } from "@agent-tracking/db";
import { describe, expect, test } from "bun:test";
import { createApp } from "./app";
import { isAllowedOrigin } from "./origin";

describe("who may call the API", () => {
  test("local pages and the serving address yes, other sites no, tools without Origin yes", () => {
    expect(isAllowedOrigin(undefined, "127.0.0.1:4317")).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173", "127.0.0.1:4317")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:4317", "127.0.0.1:4317")).toBe(true);
    expect(isAllowedOrigin("tauri://localhost", "127.0.0.1:4317")).toBe(true);
    expect(isAllowedOrigin("http://192.168.1.20:4317", "192.168.1.20:4317")).toBe(true);
    expect(isAllowedOrigin("https://evil.example", "127.0.0.1:4317")).toBe(false);
    expect(isAllowedOrigin("http://localhost.evil.example", "127.0.0.1:4317")).toBe(false);
  });

  test("a request from another site is refused before doing anything", async () => {
    const app = createApp(openDb(":memory:"));
    const evil = await app.request("http://127.0.0.1:4317/api/projects", { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" });
    expect(evil.status).toBe(403);
    const ok = await app.request("http://127.0.0.1:4317/api/projects", { headers: { Origin: "http://127.0.0.1:4317", Host: "127.0.0.1:4317" } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:4317");
  });
});
