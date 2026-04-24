/**
 * Aplica uma migration SQL ao projeto Supabase via Management API.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_... npx tsx scripts/apply-migration.ts <path-to-sql>
 */
import { readFileSync } from "node:fs";

const PROJECT_REF = "emybirklqhonqodzyzet";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("❌ SUPABASE_ACCESS_TOKEN não definido.");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("❌ Uso: npx tsx scripts/apply-migration.ts <arquivo.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
console.log(`📄 Aplicando: ${file}  (${sql.length} bytes)`);

async function runSql(query: string) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase API ${res.status}: ${text}`);
  return text;
}

runSql(sql)
  .then((out) => {
    console.log("✅ Migration aplicada com sucesso.");
    if (out && out !== "[]") console.log("Output:", out);
  })
  .catch((e) => {
    console.error("❌ Erro:", e.message);
    process.exit(1);
  });
