import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import { pages, targets, configFor } from './lighthouse.config.mjs';

const require = createRequire(import.meta.url);
const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4173';
const out = process.env.AUDIT_OUTPUT || 'validation/lighthouse';
const profiles = process.env.AUDIT_PROFILE ? [process.env.AUDIT_PROFILE] : ['mobile', 'desktop'];
const selectedPages = process.env.AUDIT_PAGE ? [process.env.AUDIT_PAGE] : Object.keys(pages);
if (profiles.some(p => !['mobile', 'desktop'].includes(p)) || selectedPages.some(p => !pages[p])) throw new Error('Perfil/página inválido');
await mkdir(out, { recursive: true });
const results = [];
for (const page of selectedPages) for (const profile of profiles) for (let run = 1; run <= 3; run++) {
  console.log(`Lighthouse: ${page}, ${profile}, ${run}/3`);
  const chrome = await launch({
    chromePath: process.env.CHROME_PATH || undefined,
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const result = await lighthouse(new URL(pages[page], base).href, { port: chrome.port, output: ['html', 'json'], logLevel: 'error' }, configFor(profile));
    if (!result || result.lhr.runtimeError) throw new Error(JSON.stringify(result?.lhr.runtimeError));
    const name = `${page}-${profile}-${run}`;
    await writeFile(`${out}/${name}.html`, result.report[0]);
    await writeFile(`${out}/${name}.json`, result.report[1]);
    const scores = Object.fromEntries(Object.entries(result.lhr.categories).map(([key, value]) => [key, value.score === null ? null : Math.round(value.score * 100)]));
    if (Object.values(scores).some(value => value === null)) throw new Error(`Auditoria incompleta: ${name}`);
    const metrics = Object.fromEntries(['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time'].map(key => [key, result.lhr.audits[key].numericValue]));
    results.push({ page, profile, run, scores, metrics, warnings: result.lhr.runWarnings });
    console.log(JSON.stringify({ name, scores, metrics }));
  } finally { await chrome.kill(); }
}
const median = values => values.toSorted((a,b) => a-b)[Math.floor(values.length / 2)];
const medians = [];
for (const page of selectedPages) for (const profile of profiles) {
  const runs = results.filter(r => r.page === page && r.profile === profile);
  medians.push({ page, profile, scores: Object.fromEntries(Object.keys(targets).map(key => [key, median(runs.map(r => r.scores[key]))])), metrics: Object.fromEntries(Object.keys(runs[0].metrics).map(key => [key, median(runs.map(r => r.metrics[key]))])) });
}
const summary = { createdAt: new Date().toISOString(), base, environment: { node: process.version, lighthouse: require('lighthouse/package.json').version, os: `${os.type()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryGiB: Math.round(os.totalmem()/1024**3), chromePath: process.env.CHROME_PATH || 'auto' }, conditions: 'Build de demonstração, dados padrão, visitante, perfil limpo por medição, throttling simulado padrão Lighthouse, headless com SwiftShader; sem aquecimento ou exclusão de assets/funcionalidades.', targets, medians, results };
await writeFile(`${out}/summary.json`, JSON.stringify(summary, null, 2));
console.table(medians.map(m => ({ page: m.page, profile: m.profile, ...m.scores })));
