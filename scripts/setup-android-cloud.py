"""Toolchain Android de desarrollo, sin modificar el HOME ni desactivar TLS."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile
import urllib.parse
import urllib.request
import zipfile

TOOLS = Path('/workspace/.honor-tools')
CACHE = Path('/tmp/honor-android')
TOOLS.mkdir(exist_ok=True)
CACHE.mkdir(exist_ok=True)

def fetch(url, destination, checksum, algorithm='sha256'):
    if not destination.exists() or hashlib.new(algorithm, destination.read_bytes()).hexdigest() != checksum:
        with urllib.request.urlopen(url, timeout=120) as response, destination.open('wb') as target:
            while data := response.read(1024 * 1024):
                target.write(data)
    if hashlib.new(algorithm, destination.read_bytes()).hexdigest() != checksum:
        raise RuntimeError('El checksum oficial no coincide; no se utilizará el archivo.')

jdk_root = TOOLS / 'jdk21'
jdk = next((path for path in jdk_root.glob('*') if (path / 'bin/javac').is_file()), None)
if jdk is None:
    tag = urllib.parse.quote('jdk-21.0.12.1+1', safe='')
    request = urllib.request.Request('https://api.github.com/repos/adoptium/temurin21-binaries/releases/tags/' + tag, headers={'User-Agent': 'Honor-build'})
    with urllib.request.urlopen(request, timeout=30) as response:
        release = json.load(response)
    asset = next(item for item in release['assets'] if item['name'].startswith('OpenJDK21U-jdk_x64_linux_hotspot_') and item['name'].endswith('.tar.gz'))
    sha_asset = next(item for item in release['assets'] if item['name'] == asset['name'] + '.sha256.txt')
    with urllib.request.urlopen(sha_asset['browser_download_url'], timeout=30) as response:
        checksum = response.read().decode().split()[0]
    archive = CACHE / 'jdk21.tar.gz'
    fetch(asset['browser_download_url'], archive, checksum)
    jdk_root.mkdir(exist_ok=True)
    with tarfile.open(archive) as source:
        source.extractall(jdk_root, filter='data')
    jdk = next(path for path in jdk_root.iterdir() if (path / 'bin/javac').is_file())

sdk = TOOLS / 'android-sdk'
manager = sdk / 'cmdline-tools/19.0/bin/sdkmanager'
if not manager.exists():
    archive = CACHE / 'commandline-19.zip'
    fetch('https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip', archive, '5fdcc763663eefb86a5b8879697aa6088b041e70', 'sha1')
    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            parts = Path(member.filename).parts[1:]
            if not parts or '..' in parts:
                continue
            target = sdk.joinpath('cmdline-tools/19.0', *parts)
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read(member))
                target.chmod((member.external_attr >> 16) & 0o777 or 0o644)

env = {**os.environ, 'JAVA_HOME': str(jdk), 'ANDROID_HOME': str(sdk), 'ANDROID_USER_HOME': str(TOOLS / 'android-user'), 'GRADLE_USER_HOME': str(TOOLS / 'gradle')}
Path(env['ANDROID_USER_HOME']).mkdir(exist_ok=True)
gradle = Path(env['GRADLE_USER_HOME'])
gradle.mkdir(exist_ok=True)
properties = gradle / 'gradle.properties'
lines = properties.read_text().splitlines() if properties.exists() else []
settings = {'org.gradle.workers.max': '4'}
proxy = urllib.parse.urlparse(os.environ.get('HTTPS_PROXY', os.environ.get('https_proxy', '')))
if proxy.hostname:
    for protocol in ['http', 'https']:
        settings[f'systemProp.{protocol}.proxyHost'] = proxy.hostname
        settings[f'systemProp.{protocol}.proxyPort'] = str(proxy.port or 80)
    settings['systemProp.http.nonProxyHosts'] = 'localhost|127.*'
if Path('/etc/ssl/certs/java/cacerts').exists():
    settings['systemProp.javax.net.ssl.trustStore'] = '/etc/ssl/certs/java/cacerts'
for key, value in settings.items():
    lines = [line for line in lines if not line.startswith(key + '=')]
    lines.append(key + '=' + value)
properties.write_text('\n'.join(lines) + '\n')

needed = {'platforms;android-36': sdk / 'platforms/android-36/android.jar', 'build-tools;35.0.0': sdk / 'build-tools/35.0.0/aapt', 'build-tools;36.0.0': sdk / 'build-tools/36.0.0/aapt', 'platform-tools': sdk / 'platform-tools/adb'}
missing = [name for name, path in needed.items() if not path.exists()]
if missing:
    with (CACHE / 'sdk-install.log').open('w') as log:
        subprocess.run([str(manager), '--sdk_root=' + str(sdk), '--licenses'], input='y\n' * 100, text=True, stdout=log, stderr=subprocess.STDOUT, env=env, check=True)
        subprocess.run([str(manager), '--sdk_root=' + str(sdk), *missing], stdout=log, stderr=subprocess.STDOUT, env=env, check=True)
root = Path(__file__).resolve().parents[1]
(root / 'android/local.properties').write_text('sdk.dir=' + str(sdk) + '\n')
subprocess.run([str(jdk / 'bin/javac'), '-version'], check=True)
print('SDK Android 36, Build Tools, JDK 21 y confianza TLS del entorno preparados.')
