#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2] ?? "legal/RUNWAY_EVALUATION_TERMS.md";
const body = readFileSync(join(root, file), "utf8");
console.log(createHash("sha256").update(body, "utf8").digest("hex"));
