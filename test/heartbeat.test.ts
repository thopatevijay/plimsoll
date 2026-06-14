import { describe, expect, it } from "vitest";
import { formatAlert } from "../src/ops/heartbeat.js";

describe("alert formatting", () => {
  it("prefixes by level", () => {
    expect(formatAlert("info", "ok", "T")).toBe("🟢 [PLIMSOLL T] ok");
    expect(formatAlert("warn", "careful", "T")).toBe("🟠 [PLIMSOLL T] careful");
    expect(formatAlert("error", "boom", "T")).toBe("🔴 [PLIMSOLL T] boom");
  });
});
