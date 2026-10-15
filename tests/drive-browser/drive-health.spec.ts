import { expect, test, type Page } from '@playwright/test';
import { addInterval, archive, testDatabase, testSql } from '../helpers/health-archive';

async function setup(page: Page, zip: ArrayBuffer) {
  await page.addInitScript(() => { (window as unknown as { __drive: unknown }).__drive = { authCalls: 0, version: '1', mediaCalls: 0, unauthorized: false }; });
  await page.route('**/src/lib/cloud.ts', route => route.fulfill({ contentType: 'text/javascript', path: 'tests/fixtures/drive-cloud-browser.js' }));
  await page.route('https://www.googleapis.com/drive/v3/**', async route => {
    const state = await page.evaluate(() => (window as unknown as { __drive: { version: string; unauthorized: boolean } }).__drive);
    if (state.unauthorized) return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    expect(route.request().headers().authorization).toBe('Bearer browser-test-token');
    const url = new URL(route.request().url());
    if (url.searchParams.get('alt') === 'media') {
      await page.evaluate(() => (window as unknown as { __drive: { mediaCalls: number } }).__drive.mediaCalls++);
      return route.fulfill({ contentType: 'application/zip', body: Buffer.from(zip) });
    }
    const q = url.searchParams.get('q') ?? '';
    if (q.includes("mimeType = 'application/vnd.google-apps.folder'")) return route.fulfill({ json: { files: q.includes("'root'") ? [{ id: 'health-folder', name: 'Mi salud' }] : [] } });
    expect(q).toContain("'health-folder' in parents");
    return route.fulfill({ json: { files: [{ id: 'health-backup', name: 'Health Connect.zip', version: state.version, modifiedTime: '2026-05-0' + state.version + 'T12:00:00Z', size: String(zip.byteLength), mimeType: 'application/zip' }] } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Usar en este dispositivo' }).click();
}
async function link(page: Page) {
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByRole('button', { name: 'Conectar Drive', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: 'Mi salud', exact: true }).click();
  await dialog.getByRole('button', { name: 'Vincular esta carpeta' }).click();
  await expect(dialog).not.toBeVisible();
}
test('excluye la copia del teléfono y retoma Drive al recargar sin pedir Google ni guardar tokens en el historial', async ({ page }) => {
  const SQL = await testSql(), db = testDatabase(SQL);
  addInterval(db, 'steps_record_table', 'count', 5000, { app: 10 });
  const zip = await archive(db); db.close();
  await setup(page, zip); await link(page);
  await expect(page.locator('.drive-health')).toContainText('todavía no contiene mediciones de HONOR Health');
  await expect(page.getByText('0 días registrados en este historial.')).toBeVisible();
  await expect(page.locator('.drive-health')).toContainText('1 registros de otros orígenes omitidos');
  const settings = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('honor-bienestar-v1'); r.onsuccess = () => resolve(r.result); });
    return new Promise<unknown[]>(resolve => { const r = db.transaction('settings').objectStore('settings').getAll(); r.onsuccess = () => resolve(r.result); });
  });
  expect(JSON.stringify(settings)).not.toContain('browser-test-token');
  expect(JSON.stringify(settings)).toContain('health-folder');
  await page.reload(); await expect(page.locator('.drive-health')).toContainText('todavía no contiene mediciones de HONOR Health');
  expect(await page.evaluate(() => (window as unknown as { __drive: { authCalls: number } }).__drive.authCalls)).toBe(0);
  await page.getByRole('button', { name: 'Actualizar datos de salud' }).click();
  await expect(page.locator('.drive-health')).toContainText('todavía no contiene mediciones de HONOR Health');
  await page.getByRole('button', { name: 'Cambiar carpeta' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __drive: { authCalls: number } }).__drive.authCalls)).toBe(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.drive-health')).toContainText('todavía no contiene mediciones de HONOR Health');
  expect(await page.evaluate(() => (window as unknown as { __drive: { mediaCalls: number } }).__drive.mediaCalls)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('actualiza una copia nueva al volver a la app y conserva respuestas, peso y apuntes', async ({ page }) => {
  const SQL = await testSql(), db = testDatabase(SQL);
  addInterval(db, 'steps_record_table', 'count', 5000);
  const zip = await archive(db); db.close();
  await setup(page, zip);
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  const entry = { date: '2026-05-01', answers: { productivity: .3, energy: .75, thoughts: null, personal: null, university: null, health: null, pain: null }, activities: {}, productivityMode: 'manual', weight: 66, notes: 'Nota sintética conservada.', updatedAt: '2026-05-01T10:00:00Z' };
  await page.getByLabel('Importar Excel o respaldo').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, entries: [entry] })) });
  await page.getByRole('button', { name: 'Confirmar selección' }).click();
  await link(page);
  await expect(page.locator('.drive-health')).toContainText('1 días actualizados');
  const record = () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('honor-bienestar-v1'); r.onsuccess = () => resolve(r.result); });
    return new Promise<Record<string, unknown>>(resolve => { const r = db.transaction('days').objectStore('days').get('guest|2026-05-01'); r.onsuccess = () => resolve(r.result); });
  });
  const result = await record();
  expect(result.notes).toBe(entry.notes); expect(result.weight).toBe(66); expect(result.answers).toEqual(entry.answers); expect(result.health).toEqual({ steps: 5000 });
  await page.getByRole('button', { name: 'Actualizar datos de salud' }).click();
  await expect(page.locator('.drive-health')).toContainText('0 días actualizados');
  expect(await page.evaluate(() => (window as unknown as { __drive: { mediaCalls: number } }).__drive.mediaCalls)).toBe(2);
  // No hace falta pulsar Actualizar: al volver al frente se consulta la nueva versión.
  await page.clock.install(); await page.clock.fastForward(61000);
  await page.evaluate(() => { (window as unknown as { __drive: { version: string } }).__drive.version = '2'; window.dispatchEvent(new Event('focus')); });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __drive: { mediaCalls: number } }).__drive.mediaCalls)).toBe(3);
  expect((await record()).notes).toBe(entry.notes);
  await page.getByRole('button', { name: 'Ver mi progreso registrado' }).click();
  await expect(page.locator('.health-summary')).toContainText('5,000');
  // Una actualización no pisa el formulario que la persona está contestando.
  await page.evaluate(() => { location.hash = 'registro?fecha=2026-05-01'; });
  await page.getByRole('button', { name: 'Peso y cierre' }).click();
  await page.getByLabel('Algo que quieras recordar').fill('Edición sintética en curso.');
  await page.clock.fastForward(61000);
  await page.evaluate(() => { (window as unknown as { __drive: { version: string } }).__drive.version = '3'; window.dispatchEvent(new Event('focus')); });
  expect(await page.evaluate(() => (window as unknown as { __drive: { mediaCalls: number } }).__drive.mediaCalls)).toBe(3);
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __drive: { mediaCalls: number } }).__drive.mediaCalls)).toBe(4);
  expect((await record()).notes).toBe('Edición sintética en curso.');
});
test('un permiso vencido detiene la consulta y desvincular conserva el historial', async ({ page }) => {
  const SQL = await testSql(), db = testDatabase(SQL); addInterval(db, 'steps_record_table', 'count', 10);
  const zip = await archive(db); db.close();
  await setup(page, zip); await link(page);
  await expect(page.locator('.drive-health')).toContainText('1 días con mediciones');
  await page.evaluate(() => { (window as unknown as { __drive: { unauthorized: boolean } }).__drive.unauthorized = true; });
  await page.getByRole('button', { name: 'Actualizar datos de salud' }).click();
  await expect(page.locator('.drive-health')).toContainText('Google necesita renovar el acceso');
  // No insiste en Google automáticamente; renovar usa la carpeta recordada.
  await page.reload();
  await expect(page.locator('.drive-health')).toContainText('Google necesita renovar el acceso');
  expect(await page.evaluate(() => (window as unknown as { __drive: { authCalls: number } }).__drive.authCalls)).toBe(0);
  await page.getByRole('button', { name: 'Actualizar datos de salud' }).click();
  await expect(page.locator('.drive-health')).toContainText('1 días con mediciones');
  expect(await page.evaluate(() => (window as unknown as { __drive: { authCalls: number } }).__drive.authCalls)).toBe(1);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Desvincular carpeta' }).click();
  await expect(page.getByRole('button', { name: 'Conectar Drive', exact: true })).toBeVisible();
  await expect(page.getByText('1 días registrados en este historial.')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('honor-google-access-v1'))).toBeNull();
});

test('reutiliza el permiso con la misma cuenta Google y lo descarta al salir o cambiar de cuenta', async ({ page }) => {
  const SQL = await testSql(), db = testDatabase(SQL); addInterval(db, 'steps_record_table', 'count', 20);
  const zip = await archive(db); db.close();
  await setup(page, zip); await link(page);
  await expect(page.locator('.drive-health')).toContainText('1 días con mediciones');
  // Una carpeta configurada anteriormente para esta cuenta; solo datos ficticios.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('honor-bienestar-v1'); r.onsuccess = () => resolve(r.result); });
    await new Promise<void>(resolve => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ folder: { id: 'health-folder', name: 'Mi salud' }, email: 'drive@example.test', origin: 'com.hihonor.health' }, 'honor-drive-v1|user:owner');
      tx.oncomplete = () => resolve();
    });
  });
  await page.getByRole('button', { name: /Continuar con Google/ }).click();
  await expect(page.getByRole('heading', { name: 'Conectado con Google' })).toBeVisible();
  await expect(page.locator('.drive-health')).toContainText('1 días actualizados');
  expect(await page.evaluate(() => (window as unknown as { __drive: { authCalls: number } }).__drive.authCalls)).toBe(1);
  await page.getByRole('button', { name: 'Actualizar datos de salud' }).click();
  await expect(page.locator('.drive-health')).toContainText('0 días actualizados');
  expect(await page.evaluate(() => (window as unknown as { __drive: { authCalls: number } }).__drive.authCalls)).toBe(1);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await expect(page.locator('.drive-health')).toContainText('Google necesita renovar el acceso');
  expect(await page.evaluate(() => sessionStorage.getItem('honor-google-access-v1'))).toBeNull();
  await page.evaluate(() => { (window as unknown as { __drive: { loginUid: string } }).__drive.loginUid = 'other'; });
  await page.getByRole('button', { name: /Continuar con Google/ }).click();
  await expect(page.getByRole('heading', { name: 'Conectado con Google' })).toBeVisible();
  await expect(page.locator('.drive-health').getByRole('button', { name: 'Conectar Drive', exact: true })).toBeVisible();
  await expect(page.getByText('0 días registrados en este historial.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __drive: { authCalls: number } }).__drive.authCalls)).toBe(1);
});


test('Drive descomprime el ZIP e incorpora y grafica solo las calorías de HONOR', async ({ page }) => {
  const SQL = await testSql(), db = testDatabase(SQL);
  addInterval(db, 'active_calories_burned_record_table', 'energy', 350000);
  addInterval(db, 'active_calories_burned_record_table', 'energy', 900000, { id: 2, app: 10 });
  const zip = await archive(db); db.close();
  await setup(page, zip); await link(page);
  await expect(page.locator('.drive-health')).toContainText('1 días actualizados');
  await expect(page.getByText('Si Google rechaza la conexión', { exact: true })).toHaveCount(0);
  await page.locator('.drive-inventory summary').click();
  const rows = page.locator('.drive-inventory tbody tr');
  await expect(rows.filter({ hasText: 'HONOR Health' })).toContainText('Calorías activas');
  await expect(rows.filter({ hasText: 'HONOR Health' })).toContainText('Admitido');
  await expect(rows.filter({ hasText: 'Teléfono' })).toContainText('Fuera del filtro HONOR');
  await page.getByRole('button', { name: 'Ver mi progreso registrado' }).click();
  await expect(page.getByLabel('Evolución de salud')).toHaveValue('activeCalories');
  await expect(page.locator('.health-summary')).toContainText('Calorías activas');
  await expect(page.locator('.health-summary')).toContainText('350');
  await expect(page.locator('.health-summary')).not.toContainText('900');
  await expect(page.locator('.health-progress .recharts-line-dot')).toHaveCount(1);
});

test('Actualizar vuelve a leer el ZIP sin cambios y una nueva versión del lector revisa la copia automáticamente', async ({ page }) => {
  const SQL = await testSql(), db = testDatabase(SQL);
  addInterval(db, 'active_calories_burned_record_table', 'energy', 350000);
  const zip = await archive(db); db.close();
  await setup(page, zip); await link(page);
  await expect(page.locator('.drive-health')).toContainText('1 días actualizados');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('honor-bienestar-v1'); r.onsuccess = () => resolve(r.result); });
    await new Promise<void>(resolve => {
      const tx = db.transaction(['settings', 'days'], 'readwrite');
      tx.objectStore('days').delete('guest|2026-05-01');
      const read = tx.objectStore('settings').get('honor-drive-v1|guest');
      read.onsuccess = () => tx.objectStore('settings').put({ ...read.result, readerVersion: 1, inventory: undefined }, 'honor-drive-v1|guest');
      tx.oncomplete = () => resolve();
    });
  });
  await page.reload();
  await expect(page.locator('.drive-health')).toContainText('1 días actualizados');
  expect(await page.evaluate(() => (window as unknown as { __drive: { mediaCalls: number } }).__drive.mediaCalls)).toBe(1);
  await expect(page.locator('.drive-inventory summary')).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar datos de salud' }).click();
  await expect(page.locator('.drive-health')).toContainText('0 días actualizados');
  expect(await page.evaluate(() => (window as unknown as { __drive: { mediaCalls: number } }).__drive.mediaCalls)).toBe(2);
  await page.reload();
  await expect(page.locator('.drive-health')).toContainText('1 días con mediciones');
  // Una comprobación automática sin novedades sigue evitando descargas repetidas.
  expect(await page.evaluate(() => (window as unknown as { __drive: { mediaCalls: number } }).__drive.mediaCalls)).toBe(0);
});
