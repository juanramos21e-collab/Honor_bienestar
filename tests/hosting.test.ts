import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { describe, expect, it } from 'vitest';

const { hosting } = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
const uploads = (path: string) => !hosting.ignore.some((pattern: string) => matchesGlob(path, pattern));

describe('Publicación de web compatible con Firebase Spark', () => {
  it('excluye APK antiguos incluso si quedaron dentro de la carpeta publicada', () => {
    expect(hosting.public).toBe('dist');
    for (const path of ['Honor.apk', 'downloads/Honor-salud-android.apk', 'downloads/Honor.APK']) expect(uploads(path), path).toBe(false);
    for (const path of ['index.html', 'assets/index-version.js', 'assets/index-version.css', 'sw.js']) expect(uploads(path), path).toBe(true);
  });
  it('envía el enlace Android anterior a la descarga externa, sin alojar el APK en Firebase', () => {
    const redirect = hosting.redirects.find((item: { source: string }) => item.source === '/downloads/Honor-salud-android.apk');
    expect(redirect.type).toBe(302);
    const url = new URL(redirect.destination);
    expect(url.origin).toBe('https://github.com');
    expect(url.pathname).toBe('/juanramos21e-collab/Honor_bienestar/raw/refs/heads/descargas/Honor-salud-android.apk');
  });
});
