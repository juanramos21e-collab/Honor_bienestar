import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// cap sync puede haber copiado el APK de una publicación anterior. Son recursos generados.
rmSync(join(root, 'android/app/src/main/assets/public/downloads'), { recursive: true, force: true });
rmSync(join(root, 'dist/downloads'), { recursive: true, force: true });
const env = { ...process.env };
if (!env.JAVA_HOME && existsSync('/workspace/.honor-tools/jdk21')) env.JAVA_HOME = '/workspace/.honor-tools/jdk21/' + readdirSync('/workspace/.honor-tools/jdk21').find(name => existsSync(`/workspace/.honor-tools/jdk21/${name}/bin/javac`));
if (!env.ANDROID_HOME && existsSync('/workspace/.honor-tools/android-sdk')) env.ANDROID_HOME = '/workspace/.honor-tools/android-sdk';
if (existsSync('/workspace/.honor-tools/gradle')) env.GRADLE_USER_HOME ??= '/workspace/.honor-tools/gradle';
if (existsSync('/workspace/.honor-tools/android-user')) env.ANDROID_USER_HOME ??= '/workspace/.honor-tools/android-user';
const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
if (!sdk || !existsSync(join(sdk, 'platforms/android-36/android.jar'))) throw new Error('Instala Android SDK 36 y configura ANDROID_HOME. Consulta docs/ANDROID-SALUD.md.');
const windows = process.platform === 'win32', keytool = env.JAVA_HOME ? join(env.JAVA_HOME, 'bin', windows ? 'keytool.exe' : 'keytool') : 'keytool';
mkdirSync(join(root, 'android/.local'), { recursive: true });
if (!existsSync(join(root, 'android/.local/debug.keystore'))) execFileSync(keytool, ['-genkeypair', '-keystore', join(root, 'android/.local/debug.keystore'), '-storepass', 'android', '-keypass', 'android', '-alias', 'androiddebugkey', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=Android Debug,O=Android,C=US'], { env, stdio: 'inherit' });
const wrapper = join(root, 'android', windows ? 'gradlew.bat' : 'gradlew');
if (windows) execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'gradlew.bat --no-daemon :app:assembleDebug :app:testDebugUnitTest'], { cwd: join(root, 'android'), env, stdio: 'inherit' });
else execFileSync(wrapper, ['--no-daemon', ':app:assembleDebug', ':app:testDebugUnitTest'], { cwd: join(root, 'android'), env, stdio: 'inherit' });
const apk = join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
const certificate = execFileSync(keytool, ['-exportcert', '-rfc', '-keystore', join(root, 'android/.local/debug.keystore'), '-storepass', 'android', '-alias', 'androiddebugkey'], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const { X509Certificate } = await import('node:crypto'); const cert = new X509Certificate(certificate);
writeFileSync(join(root, 'android/android-signing.json'), JSON.stringify({ packageName: 'app.honor.bienestar', sha1: cert.fingerprint.replaceAll(':', '').toLowerCase(), sha256: cert.fingerprint256.replaceAll(':', '').toLowerCase(), variant: 'debug' }, null, 2));
mkdirSync(join(root, 'android/releases'), { recursive: true }); copyFileSync(apk, join(root, 'android/releases/Honor-salud-android.apk'));
console.log('Web preparada en dist/. APK de prueba en android/releases/, fuera de Firebase Hosting Spark. La clave de firma queda fuera de Git y de las entregas.');
