import fs from "node:fs";
import path from "node:path";

import { buildDriInsertSql, flattenDriPayload } from "../lib/dri/transform.js";

function usage() {
  console.error("Usage: node scripts/import-dri-json.mjs <input-json> [output-sql]");
  process.exit(1);
}

const [, , inputPath, outputPathArg] = process.argv;
if (!inputPath) usage();

const resolvedInput = path.resolve(process.cwd(), inputPath);
if (!fs.existsSync(resolvedInput)) {
  console.error(`Input file not found: ${resolvedInput}`);
  process.exit(1);
}

const outputPath = outputPathArg
  ? path.resolve(process.cwd(), outputPathArg)
  : path.resolve(process.cwd(), "supabase/seed/dri_values.sql");

const payload = JSON.parse(fs.readFileSync(resolvedInput, "utf8"));
const records = flattenDriPayload(payload);
const sql = buildDriInsertSql(records);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sql, "utf8");

console.log(`Generated ${records.length} DRI records into ${outputPath}`);
