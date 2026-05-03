// EAS exige lockfile no formato npm@10. npm@11+ regenera o lockfile com
// uma sintaxe nova que faz o build EAS quebrar (overrides + workspaces).
// Quando o dev roda `npm install` com npm@11+, abortamos com instruções.
//
// Permitido sem alarde:
//  - `npm ci`           → respeita o lockfile existente, não regenera.
//  - `npm run lock:fix` → invoca `npx --yes npm@10 install`, então a versão
//                         que aciona o preinstall já é npm@10.
//
// Bloqueado:
//  - `npm install` com npm@11+ → corromperia o lockfile silenciosamente.

const cmd = process.env.npm_command || ''; // 'install' | 'ci' | 'install-test' | etc.
const ua = process.env.npm_config_user_agent || '';
const npmMajor = parseInt((ua.match(/\bnpm\/(\d+)/) || [])[1] || '0', 10);

if (cmd === 'install' && npmMajor >= 11) {
  console.error('');
  console.error('🚫 EAS lockfile guard (crialook-app)');
  console.error('');
  console.error(`   You ran \`npm install\` with npm@${npmMajor}.`);
  console.error('   EAS build expects the npm@10 lockfile format — npm@11+');
  console.error('   regenerates package-lock.json with syntax that breaks EAS.');
  console.error('');
  console.error('   ✅  Run instead:   npm run lock:fix');
  console.error('   ✅  Or in CI:      npm ci --legacy-peer-deps');
  console.error('');
  console.error('   See package.json #_lock_warning for the full story.');
  console.error('');
  process.exit(1);
}
