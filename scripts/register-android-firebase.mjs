import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export async function registerAndroid(run, certificate) {
  if (certificate.packageName !== 'app.honor.bienestar' || !/^[a-f0-9]{40}$/i.test(certificate.sha1) || !/^[a-f0-9]{64}$/i.test(certificate.sha256)) throw new Error('El certificado del APK no es válido. Compila o usa los metadatos incluidos en el paquete.');
  const apps = await run(['apps:list', 'ANDROID']);
  if (!Array.isArray(apps)) throw new Error('Firebase no devolvió la lista de aplicaciones.');
  let app = apps.find(item => item.packageName === certificate.packageName);
  if (!app) app = await run(['apps:create', 'ANDROID', 'Honor Mi bienestar Android', '--package-name', certificate.packageName]);
  if (!app?.appId) throw new Error('No se pudo registrar la aplicación Android.');
  const hashes = await run(['apps:android:sha:list', app.appId]);
  if (!Array.isArray(hashes)) throw new Error('No se pudo comprobar el certificado registrado.');
  const plain = value => String(value).replaceAll(':', '').toLowerCase();
  for (const hash of [certificate.sha1, certificate.sha256]) {
    if (!hashes.some(item => plain(item.shaHash) === plain(hash))) await run(['apps:android:sha:create', app.appId, hash]);
  }
  return app.appId;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const metadata = JSON.parse(readFileSync(join(root, 'android/android-signing.json'), 'utf8'));
  const npmCli = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].find(path => path && existsSync(path));
  if (!npmCli) throw new Error('Ejecuta este paso con npm run android:google.');
  const run = async args => {
    const output = execFileSync(process.execPath, [npmCli, 'exec', '--yes', '--package=firebase-tools@15.33.0', '--', 'firebase', ...args, '--project', 'honor-bienestar', '--non-interactive', '--json'], { cwd: root, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
    const data = JSON.parse(output);
    if (data.status !== 'success') throw new Error('Firebase rechazó la operación. Revisa la sesión y el acceso al proyecto.');
    return data.result;
  };
  const appId = await registerAndroid(run, metadata);
  writeFileSync(join(root, 'android/firebase-registration.json'), JSON.stringify({ appId, packageName: metadata.packageName, registeredAt: new Date().toISOString() }, null, 2));
  console.log('Aplicación Android y certificados registrados en honor-bienestar. Ya puedes probar el acceso Google en el APK.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
