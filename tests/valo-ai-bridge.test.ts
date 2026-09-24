import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script = path.resolve("scripts/valo-ai-bridge.mjs");

describe("VALO AI Bridge adapter", () => {
  it("selects matching graph context and emits no effect authority", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ua-valo-"));
    fs.mkdirSync(path.join(root, ".ua"));
    fs.writeFileSync(path.join(root, ".ua", "knowledge-graph.json"), JSON.stringify({
      nodes: [
        { id: "auth", name: "authorizeEffect", path: "src/auth.ts", summary: "fresh authority check" },
        { id: "ui", name: "Dashboard", path: "src/ui.ts" }
      ],
      edges: [{ source: "auth", target: "ui", type: "calls" }]
    }));
    const out = JSON.parse(execFileSync(process.execPath, [script, "--root", root, "--query", "authority"], { encoding: "utf8" }));
    expect(out.schema).toBe("valo.ai-bridge.context.v1");
    expect(out.constraints.effectAuthority).toBe("none");
    expect(out.constraints.directEffectPath).toBe(false);
    expect(out.context.nodes).toHaveLength(1);
    expect(out.context.nodes[0].id).toBe("auth");
  });
});
