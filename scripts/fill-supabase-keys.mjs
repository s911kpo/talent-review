// Reads SUPABASE_ACCESS_TOKEN from .env.local, looks up the project and its API keys with the
// Supabase CLI, and writes them back to .env.local. Prints field names only, never values.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = '.env.local';
const text = readFileSync(FILE, 'utf8');
const get = (name) => text.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() ?? '';

const token = get('SUPABASE_ACCESS_TOKEN');
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is empty in .env.local.');
  process.exit(1);
}

const cli = (...args) => {
  const out = execFileSync(join('node_modules', '.bin', 'supabase.cmd'), [...args, '-o', 'json'], {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  return JSON.parse(out.slice(out.search(/[[{]/)));
};

let projects;
try {
  projects = cli('projects', 'list');
} catch (err) {
  console.error('Could not list projects:', String(err.stderr ?? err.message).split('\n')[0]);
  process.exit(1);
}
const wanted = process.argv[2];
const project = wanted ? projects.find((p) => (p.id ?? p.ref) === wanted || p.name === wanted) : projects[0];
console.log(`Projects found: ${projects.map((p) => `${p.name} (${p.region})`).join(', ') || 'none'}`);
if (!project) process.exit(1);
if (projects.length > 1 && !wanted) {
  console.error('More than one project. Rerun with the project name as an argument.');
  process.exit(1);
}

const ref = project.id ?? project.ref;
const keys = cli('projects', 'api-keys', '--project-ref', ref);
const key = (name) => keys.find((k) => k.name === name)?.api_key;
const anon = key('anon');
const service = key('service_role');
if (!anon || !service) {
  console.error(`Expected anon and service_role keys; found: ${keys.map((k) => k.name).join(', ')}`);
  process.exit(1);
}

const values = {
  SUPABASE_PROJECT_REF: ref,
  VITE_SUPABASE_URL: `https://${ref}.supabase.co`,
  VITE_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service,
};
let next = text;
for (const [name, value] of Object.entries(values)) {
  next = new RegExp(`^${name}=`, 'm').test(next)
    ? next.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}=${value}`)
    : `${next.trimEnd()}\n${name}=${value}\n`;
}
writeFileSync(FILE, next, 'utf8');
console.log(`Using project: ${project.name}`);
console.log(`Wrote: ${Object.keys(values).join(', ')}`);
console.log(`Database password present: ${get('SUPABASE_DB_PASSWORD') ? 'yes' : 'no'}`);
