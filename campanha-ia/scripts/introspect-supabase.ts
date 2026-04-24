/**
 * Introspecta o schema atual do Supabase do projeto CriaLook.
 * Usa o Supabase Management API (PAT).
 *
 * Run: SUPABASE_ACCESS_TOKEN=sbp_... npx tsx scripts/introspect-supabase.ts
 *
 * Gera:
 *  - supabase/migrations/00000000000000_baseline.sql (schema + policies + RLS state)
 *  - docs/supabase-inventory.md  (lista de tabelas + policies + indexes em humano-legível)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const PROJECT_REF = "emybirklqhonqodzyzet";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("❌ SUPABASE_ACCESS_TOKEN não definido no env.");
  process.exit(1);
}

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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase API ${res.status}: ${text}`);
  }
  return res.json();
}

function writeFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
  console.log(`  ✓ ${path}`);
}

async function main() {
  console.log("🔍 Introspectando projeto Supabase...\n");

  // 1. Lista de tabelas no schema public
  const tables = (await runSql(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `)) as Array<{ table_name: string }>;
  console.log(`Tabelas encontradas: ${tables.length}`);
  tables.forEach((t) => console.log(`  - ${t.table_name}`));
  console.log();

  // 2. RLS state por tabela
  const rlsState = (await runSql(`
    SELECT c.relname AS table_name,
           c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `)) as Array<{ table_name: string; rls_enabled: boolean; rls_forced: boolean }>;

  // 3. Policies
  const policies = (await runSql(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `)) as Array<Record<string, unknown>>;

  // 4. Indexes
  const indexes = (await runSql(`
    SELECT schemaname, tablename, indexname, indexdef
    FROM pg_indexes WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `)) as Array<{ tablename: string; indexname: string; indexdef: string }>;

  // 5. Funções (RPCs) do schema public
  const functions = (await runSql(`
    SELECT p.proname AS name,
           pg_get_function_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) AS result,
           l.lanname AS lang,
           CASE WHEN p.prosecdef THEN 'definer' ELSE 'invoker' END AS security,
           pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
    ORDER BY p.proname;
  `)) as Array<Record<string, string>>;

  // 6. Colunas por tabela.
  // Usamos format_type(atttypid, atttypmod) de pg_attribute em vez de information_schema,
  // porque information_schema.columns reporta colunas de array como `data_type='ARRAY'`
  // sem o tipo do elemento — SQL inválido.
  const columns = (await runSql(`
    SELECT n.nspname AS schema,
           c.relname AS table_name,
           a.attname AS column_name,
           pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
           NOT a.attnotnull AS is_nullable,
           pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
           a.attnum AS ordinal_position
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum;
  `)) as Array<Record<string, unknown>>;

  // 7. Constraints (PK, FK, UNIQUE)
  const constraints = (await runSql(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
           string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns,
           ccu.table_name AS fk_table,
           string_agg(ccu.column_name, ', ' ORDER BY kcu.ordinal_position) AS fk_columns
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public'
    GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type, ccu.table_name
    ORDER BY tc.table_name, tc.constraint_type;
  `)) as Array<Record<string, unknown>>;

  // ──────────────────────────────────────────────────────────────
  // Relatório Markdown
  // ──────────────────────────────────────────────────────────────
  const lines: string[] = [];
  lines.push("# Supabase — Inventário do Schema (introspecção automática)\n");
  lines.push(`_Gerado em ${new Date().toISOString()}_\n`);
  lines.push(`Projeto: \`${PROJECT_REF}\`\n`);

  lines.push("## RLS por tabela\n");
  lines.push("| Tabela | RLS habilitado | Forçado |");
  lines.push("|---|---|---|");
  for (const t of rlsState) {
    lines.push(`| ${t.table_name} | ${t.rls_enabled ? "✅" : "❌"} | ${t.rls_forced ? "✅" : "—"} |`);
  }
  lines.push("");

  lines.push("## Policies\n");
  if (policies.length === 0) lines.push("_Nenhuma policy cadastrada._\n");
  for (const p of policies) {
    lines.push(`- **${p.tablename}** · \`${p.policyname}\` (${p.cmd}, ${p.permissive})`);
    lines.push(`  - roles: ${JSON.stringify(p.roles)}`);
    if (p.qual) lines.push(`  - USING: \`${p.qual}\``);
    if (p.with_check) lines.push(`  - WITH CHECK: \`${p.with_check}\``);
  }
  lines.push("");

  lines.push("## Funções (RPCs) no schema public\n");
  for (const f of functions) {
    lines.push(`### \`${f.name}(${f.args})\` → ${f.result}`);
    lines.push(`_Lang: ${f.lang} · Security: ${f.security}_\n`);
    lines.push("```sql");
    lines.push(f.definition);
    lines.push("```\n");
  }

  lines.push("## Índices\n");
  for (const i of indexes) {
    lines.push(`- \`${i.indexname}\` em \`${i.tablename}\``);
    lines.push(`  \`${i.indexdef}\``);
  }
  lines.push("");

  lines.push("## Constraints\n");
  for (const c of constraints) {
    const extra = c.constraint_type === "FOREIGN KEY" ? ` → ${c.fk_table}(${c.fk_columns})` : "";
    lines.push(`- \`${c.table_name}\` · ${c.constraint_type} \`${c.constraint_name}\` (${c.columns})${extra}`);
  }

  writeFile(
    "docs/supabase-inventory.md",
    lines.join("\n"),
  );

  // ──────────────────────────────────────────────────────────────
  // Baseline SQL (reconstrói o schema)
  // ──────────────────────────────────────────────────────────────
  const sql: string[] = [];
  sql.push("-- ═══════════════════════════════════════════════════════════");
  sql.push("-- CriaLook — Schema Baseline (gerado por introspect-supabase.ts)");
  sql.push(`-- Gerado em ${new Date().toISOString()}`);
  sql.push("-- Projeto: " + PROJECT_REF);
  sql.push("-- ═══════════════════════════════════════════════════════════\n");

  // Tabelas + colunas
  const byTable = new Map<string, typeof columns>();
  for (const col of columns) {
    const t = col.table_name as string;
    if (!byTable.has(t)) byTable.set(t, []);
    byTable.get(t)!.push(col);
  }
  for (const [tableName, cols] of byTable) {
    sql.push(`-- ── Tabela: ${tableName} ──`);
    sql.push(`CREATE TABLE IF NOT EXISTS public.${tableName} (`);
    const colDefs = cols.map((c) => {
      // data_type já vem formatado (ex: "text", "integer", "text[]", "numeric(10,2)")
      let def = `  ${c.column_name} ${c.data_type}`;
      // pg_attribute: is_nullable é booleano verdadeiro quando pode ser null.
      if (c.is_nullable === false) def += " NOT NULL";
      if (c.column_default) def += ` DEFAULT ${c.column_default}`;
      return def;
    });
    sql.push(colDefs.join(",\n"));
    sql.push(");\n");
  }

  // Indexes
  sql.push("\n-- ══ Índices ══");
  for (const i of indexes) {
    if (!i.indexname.endsWith("_pkey")) {
      sql.push(`${i.indexdef};`);
    }
  }

  // RLS
  sql.push("\n-- ══ RLS ══");
  for (const t of rlsState) {
    if (t.rls_enabled) {
      sql.push(`ALTER TABLE public.${t.table_name} ENABLE ROW LEVEL SECURITY;`);
      if (t.rls_forced) {
        sql.push(`ALTER TABLE public.${t.table_name} FORCE ROW LEVEL SECURITY;`);
      }
    }
  }

  // Policies
  sql.push("\n-- ══ Policies ══");
  for (const p of policies) {
    const rolesArr = p.roles as string[] | undefined;
    const rolesStr = Array.isArray(rolesArr) ? rolesArr.join(", ") : "public";
    sql.push(`-- policy ${p.policyname} on ${p.tablename}`);
    sql.push(`DROP POLICY IF EXISTS "${p.policyname}" ON public.${p.tablename};`);
    let create = `CREATE POLICY "${p.policyname}" ON public.${p.tablename}`;
    create += ` AS ${p.permissive === "PERMISSIVE" ? "PERMISSIVE" : "RESTRICTIVE"}`;
    create += ` FOR ${p.cmd} TO ${rolesStr}`;
    if (p.qual) create += ` USING (${p.qual})`;
    if (p.with_check) create += ` WITH CHECK (${p.with_check})`;
    sql.push(`${create};\n`);
  }

  // Functions
  sql.push("\n-- ══ RPCs / Functions ══");
  for (const f of functions) {
    sql.push(f.definition + ";\n");
  }

  writeFile(
    "supabase/migrations/00000000000000_baseline.sql",
    sql.join("\n"),
  );

  console.log("\n✅ Concluído.\n");
  console.log(`📊 Resumo:`);
  console.log(`   - ${tables.length} tabelas`);
  console.log(`   - ${policies.length} policies RLS`);
  console.log(`   - ${rlsState.filter((t) => t.rls_enabled).length}/${rlsState.length} tabelas com RLS habilitado`);
  console.log(`   - ${functions.length} funções (RPCs) no schema public`);
  console.log(`   - ${indexes.length} índices`);
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
