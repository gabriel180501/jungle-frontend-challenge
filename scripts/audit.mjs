import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Com uma URL explícita, audita um servidor já em execução (inclusive o deploy).
// Sem URL, sobe e encerra seu próprio preview do build existente.
const server = process.env.AUDIT_BASE_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'inherit' });
try {
  if (server) {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (server.exitCode !== null) throw new Error('Preview não iniciou. Gere o build e verifique a porta 4173.');
      try { const response = await fetch('http://127.0.0.1:4173'); ready = response.ok; } catch { /* aguardando servidor */ }
      if (ready) break;
      await delay(250);
    }
    if (!ready) throw new Error('Preview indisponível. Execute npm run build:demo.');
  }
  const child = spawn(process.execPath, ['scripts/lighthouse.mjs'], { stdio: 'inherit', env: process.env });
  process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); });
} finally { server?.kill(); }
