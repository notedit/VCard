import { spawn } from 'node:child_process';
import { syncDevVars } from './dev-vars-lib.mjs';

const root = process.cwd();

try {
  const result = syncDevVars(root);
  console.log(`Synced ${result.keys.join(', ')} from ${result.source} -> ${result.target}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const children = [
  run('api', 'npm', ['run', 'dev:wrangler', '--workspace', '@vcard/api']),
  run('web', 'npm', ['run', 'dev', '--workspace', '@vcard/web', '--', '--host', '127.0.0.1'], {
    VITE_API_BASE: 'http://localhost:8787',
  }),
];

function run(label, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => write(label, chunk));
  child.stderr.on('data', (chunk) => write(label, chunk));
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[${label}] exited with ${signal ?? code}`);
    shutdown(code ?? 1);
  });

  return child;
}

function write(label, chunk) {
  for (const line of String(chunk).split(/\r?\n/)) {
    if (line.length > 0) console.log(`[${label}] ${line}`);
  }
}

let shuttingDown = false;
function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) child.kill('SIGINT');
  setTimeout(() => process.exit(code), 250);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
