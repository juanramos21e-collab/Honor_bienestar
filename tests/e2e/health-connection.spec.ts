import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) { await page.goto('/'); await page.getByRole('button', { name: 'Usar en este dispositivo' }).click(); await page.getByRole('button', { name: 'Ajustes', exact: true }).click(); }
const card = (page: Page) => page.locator('.health-connection');

test('navegador: muestra la guía, la fuente exclusiva HONOR y el acceso autorizado a Drive', async ({ page }) => {
  await start(page);
  await expect(card(page).getByRole('heading', { name: 'Datos de salud', exact: true })).toBeVisible();
  await expect(card(page)).toContainText('Los registros del teléfono y de otras aplicaciones quedan fuera');
  await expect(card(page).getByRole('link', { name: 'HONOR Health en Google Play' })).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=com.hihonor.health');
  await expect(card(page).getByRole('link', { name: 'Descargar versión Android' })).toHaveCount(0);
  await expect(card(page).getByRole('button', { name: 'Actualizar datos', exact: true })).toHaveCount(0);
  await expect(card(page).getByRole('button', { name: 'Conectar Drive', exact: true })).toBeVisible();
  await expect(card(page).locator('.health-setup li')).toHaveCount(5);
});

test('Android genérico: detectar, pedir lectura, actualizar, guardar y ver progreso sin perder apuntes', async ({ page }) => {
  await page.addInitScript({ path: 'tests/fixtures/health-native-browser.js' });
  await start(page);
  await expect(card(page)).toContainText('Xiaomi Dispositivo de prueba');
  await expect(card(page).getByRole('button', { name: 'Instalar Salud de HONOR', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('button', { name: /¿Qué hiciste hoy/ }).click();
  await page.getByRole('button', { name: 'Peso y cierre' }).click();
  await page.getByLabel('Algo que quieras recordar').fill('Conservar este apunte.');
  await page.getByRole('button', { name: 'Guardar mi día', exact: true }).click();
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await card(page).getByRole('button', { name: 'Conectar datos de salud', exact: true }).click();
  await expect(card(page)).toContainText('Acceso concedido a 3 tipos de datos');
  const date = await card(page).getByLabel('Salud hasta', { exact: true }).inputValue();
  await page.evaluate(date => { (window as unknown as { __health: { entries: unknown[] } }).__health.entries = [{ date, health: { steps: 8000, sleepHours: 7.5, heartRate: 74 } }]; }, date);
  await card(page).getByRole('button', { name: 'Buscar aplicaciones con datos', exact: true }).click();
  await expect(card(page).getByLabel('Aplicación de origen')).toHaveValue('com.hihonor.health');
  await card(page).getByRole('button', { name: 'Actualizar datos', exact: true }).click();
  await expect(card(page)).toContainText('1 días con mediciones · 1 días actualizados');
  await expect(card(page)).toContainText('Último guardado de salud:');
  await page.reload();
  await expect(card(page)).toContainText('Último guardado de salud:');
  await expect(card(page).getByRole('button', { name: 'Actualizar datos', exact: true })).toBeEnabled();
  await expect(card(page).getByLabel('Aplicación de origen')).toHaveValue('com.hihonor.health');
  await card(page).getByRole('button', { name: 'Ver mi progreso registrado', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salud y actividad' })).toBeVisible();
  await expect(page.locator('.health-summary')).toContainText('8,000');
  await expect(page.getByText('Conservar este apunte.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Android: instalación pendiente, permisos denegados y ausencia de datos se distinguen', async ({ page }) => {
  await page.addInitScript({ path: 'tests/fixtures/health-native-browser.js' });
  await page.addInitScript('window.__health.state="install_required"; window.__health.denied=true;'); await start(page);
  await card(page).getByRole('button', { name: 'Instalar o actualizar Health Connect' }).click();
  expect(await page.evaluate('window.__health.calls.some(c=>c.method==="openSetup" && c.options.target==="provider")')).toBe(true);
  await page.evaluate('window.__health.state="available"');
  await card(page).getByRole('button', { name: 'Comprobar compatibilidad de nuevo' }).click();
  await card(page).getByRole('button', { name: 'Conectar datos de salud', exact: true }).click();
  await expect(card(page).getByRole('alert')).toContainText('No se concedió acceso');
  await page.evaluate('window.__health.denied=false; window.__health.sources=[];');
  await card(page).getByRole('button', { name: 'Conectar datos de salud', exact: true }).click();
  await card(page).getByRole('button', { name: 'Buscar aplicaciones con datos', exact: true }).click();
  await expect(card(page).getByRole('alert')).toContainText('No hay datos compartidos');
  await expect(card(page)).not.toContainText('Último guardado de salud:');
  await expect(card(page).getByRole('button', { name: 'Actualizar datos', exact: true })).toBeDisabled();
});

test('voz Android: la lectura nativa termina antes de la señal y de abrir el micrófono', async ({ page }) => {
  await page.addInitScript({ path: 'tests/fixtures/health-native-browser.js' });
  await page.addInitScript({ path: 'tests/fixtures/voice-browser.js' });
  await page.addInitScript(`(() => {
    const base = window.Capacitor.nativePromise;
    const model = { speaks: [], listening: false, overlap: false, resolveSpeech: null, resolveListen: null, stops: 0 };
    window.__nativeVoice = model;
    window.Capacitor.nativePromise = async (plugin, method, options) => {
      if (plugin !== 'DeviceTools' || method === 'requestMicrophone') return base(plugin, method, options);
      if (method === 'stop') { model.stops++; model.listening = false; model.resolveListen = null; return {}; }
      if (method === 'speak') { if (model.listening) model.overlap = true; model.speaks.push(options.text); return new Promise(resolve => model.resolveSpeech = () => { model.resolveSpeech = null; resolve({}); }); }
      if (method === 'cue') return new Promise(resolve => model.resolveCue = () => { model.resolveCue = null; resolve({}); });
      if (method === 'listen') { if (model.resolveSpeech || model.resolveCue) model.overlap = true; model.listening = true; return new Promise(resolve => model.resolveListen = text => { model.listening = false; model.resolveListen = null; resolve({ transcript: text }); }); }
      return {};
    };
  })()`);
  await start(page);
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('button', { name: /¿Qué hiciste hoy/ }).click();
  await page.getByRole('button', { name: 'Comenzar por voz' }).click();
  await expect(page.locator('.voice-turn')).toHaveClass(/speaking/);
  expect(await page.evaluate('window.__nativeVoice.listening')).toBe(false);
  await expect.poll(() => page.evaluate('typeof window.__nativeVoice.resolveSpeech')).toBe('function');
  await page.evaluate('window.__nativeVoice.resolveSpeech()');
  await expect(page.locator('.voice-turn')).toHaveClass(/cue/);
  expect(await page.evaluate('window.__nativeVoice.listening')).toBe(false);
  await page.evaluate('window.__nativeVoice.resolveCue()');
  await expect.poll(() => page.evaluate('window.__nativeVoice.listening')).toBe(true);
  await page.evaluate('window.__nativeVoice.resolveListen("sí")');
  await expect(page.locator('.voice-counter')).toContainText('Pregunta 2');
  await page.getByRole('button', { name: 'Pausar voz' }).click();
  await expect.poll(() => page.evaluate('window.__nativeVoice.listening')).toBe(false);
  expect(await page.evaluate('window.__nativeVoice.overlap')).toBe(false);
});
