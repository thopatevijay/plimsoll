import { describe, expect, it } from "vitest";
import { formatAlert } from "../src/ops/heartbeat.js";

describe("alert formatting", () => {
  it("prefixes by level", () => {
    expect(formatAlert("info", "ok", "T")).toBe("🟢 [SENTINEL T] ok");
    expect(formatAlert("warn", "careful", "T")).toBe("🟠 [SENTINEL T] careful");
    expect(formatAlert("error", "boom", "T")).toBe("🔴 [SENTINEL T] boom");
  });
});
