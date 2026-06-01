import { createHash } from "node:crypto";

export function hashContent(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}
