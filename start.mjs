import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from './server.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
if (existsSync(`${root}.env`)) loadEnvFile(`${root}.env`);
const binary = `${root}.runtime/ollama/ollama`;
const bundled = existsSync(binary);
const ollama = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
let child;
if (bundled && !process.env.OLLAMA_URL) {
  try { await fetch(`${ollama}/api/version`, { signal: AbortSignal.timeout(1000) }); }
  catch {
    child = spawn(binary, ['serve'], {
      env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434', OLLAMA_MODELS: `${root}.runtime/models`, OLLAMA_NO_CLOUD: '1', OLLAMA_NUM_PARALLEL: '1' },
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    child.on('error', () => console.error('Could not start Ollama. Open Ollama, then restart this app.'));
  }
}
const server = createApp({ ollama });
server.listen(Number(process.env.PORT || 5200), '127.0.0.1', () => console.log(`Gemma notes: http://localhost:${server.address().port}\nChoose Google API or Local in the app.`));
server.on('error', error => { console.error(error.message); child?.kill(); process.exit(1); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child?.kill(); server.close(); process.exit(0); });
