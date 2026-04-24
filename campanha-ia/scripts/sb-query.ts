/** Helper CLI: roda um SELECT e imprime o resultado. */
const PROJECT_REF = "emybirklqhonqodzyzet";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error("SUPABASE_ACCESS_TOKEN missing"); process.exit(1); }
const query = process.argv.slice(2).join(" ");
if (!query) { console.error("Pass SQL as args"); process.exit(1); }
fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
})
  .then((r) => r.text())
  .then((t) => console.log(t));
