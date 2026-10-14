import { test, expect } from '@playwright/test';

test('Android: guardar, editar sin duplicar, retomar un borrador y usar sin conexión', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar en este dispositivo' }).click();
  await expect(page.getByRole('heading', { name: '¿Por dónde empezamos?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /¿Qué hiciste hoy/ }).click();
  await page.getByRole('group', { name: 'Trabajar en mis proyectos', exact: true }).getByRole('button', { name: 'Sí', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Energía: 75%', exact: true }).click();
  await page.getByRole('button', { name: 'Salud: 100%', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('¿Cuál es tu peso hoy?').fill('54,3');
  await page.getByLabel('Algo que quieras recordar').fill('Un pequeño paso');
  await page.getByRole('button', { name: 'Guardar mi día', exact: true }).click();
  await expect(page.getByText('65.7%', { exact: true })).toBeVisible();
  await expect(page.locator('.stat-card').filter({ hasText: 'Tu último peso' }).locator('strong')).toHaveText('54.3 kg');
  await page.reload();
  await page.getByRole('button', { name: /Revisa cómo va tu día/ }).click();
  await expect(page.getByRole('group', { name: 'Trabajar en mis proyectos', exact: true }).getByRole('button', { name: 'Sí', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Cómo me siento' }).click();
  await expect(page.getByRole('button', { name: 'Energía: 75%', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Energía: 100%', exact: true }).click();
  await expect(page.getByText('Borrador guardado en este dispositivo')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Cómo me siento' }).click();
  await expect(page.getByRole('button', { name: 'Energía: 100%', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Peso y cierre' }).click();
  await expect(page.getByLabel('¿Cuál es tu peso hoy?')).toHaveValue('54.3');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('74%', { exact: true })).toBeVisible();
  const records = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('honor-bienestar-v1'); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
    return new Promise<unknown[]>((resolve, reject) => { const r = db.transaction('days').objectStore('days').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
  });
  expect(records).toHaveLength(1);
  await page.getByRole('button', { name: /Mira cuánto has avanzado/ }).click();
  await expect(page.getByRole('heading', { name: 'Evolución de tu peso' })).toBeVisible();
  await page.getByRole('button', { name: 'Semana', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lo que forma tu día' })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => !!await navigator.serviceWorker.ready)).toBe(true);
  await page.reload(); // La segunda visita queda bajo control del service worker.
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tu progreso, a tu ritmo.' })).toBeVisible();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('button', { name: /Revisa cómo va tu día/ }).click();
  await page.getByRole('button', { name: 'Peso y cierre' }).click();
  await page.getByLabel('¿Cuál es tu peso hoy?').fill('54.6');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.locator('.stat-card').filter({ hasText: 'Tu último peso' }).locator('strong')).toHaveText('54.6 kg');
  expect(errors).toEqual([]);
});

test('importar respaldo con conflicto, exportar y cambiar las dos imágenes', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Usar en este dispositivo' }).click();
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  const entry = { date: '2026-10-10', answers: { productivity: .5, energy: .8, thoughts: .2, personal: .4, university: .3, health: 1, pain: .1 }, activities: {}, productivityMode: 'manual', weight: 54.3, notes: 'Importado', updatedAt: '2026-10-10T12:00:00Z' };
  const upload = async (weight: number) => page.getByLabel('Importar Excel o respaldo').setInputFiles({ name: 'respaldo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, entries: [{ ...entry, weight }] })) });
  await upload(54.3); await page.getByRole('button', { name: 'Confirmar selección' }).click();
  await expect(page.getByText('1 días registrados en este historial.')).toBeVisible();
  await upload(55);
  await expect(page.getByRole('button', { name: 'Confirmar selección' })).toBeDisabled();
  await page.getByRole('radio', { name: /Archivo importado/ }).check();
  await page.getByRole('button', { name: 'Confirmar selección' }).click();
  await expect(page.getByText('1 días registrados en este historial.')).toBeVisible();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Descargar respaldo' }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toMatch(/honor-respaldo.*\.json$/);
  const path = await download.path(); const { readFile } = await import('node:fs/promises'); const backup = JSON.parse(await readFile(path!, 'utf8')); expect(backup.entries[0].weight).toBe(55);
  await page.getByLabel('¿Cómo te llamas?').fill('Juan'); await page.getByRole('button', { name: 'Guardar nombre' }).click();
  const image = { name: 'foto.png', mimeType: 'image/png', buffer: await readFile('public/icon-192.png') };
  await page.getByLabel('Imagen de portada', { exact: true }).setInputFiles(image);
  await expect(page.locator('.image-preview.hero')).toHaveAttribute('style', /data:image\/webp/);
  await page.getByLabel('Imagen del menú', { exact: true }).setInputFiles(image);
  await expect(page.locator('.image-preview.panel')).toHaveAttribute('style', /data:image\/webp/);
  await page.reload();
  await expect(page.locator('.image-preview.hero')).toHaveAttribute('style', /data:image\/webp/);
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Hola, Juan/ })).toBeVisible();
  await page.getByRole('button', { name: 'Progreso', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar y editar este registro' }).click();
  await page.getByRole('button', { name: 'Cómo me siento' }).click();
  await page.getByRole('button', { name: 'Energía: 50%', exact: true }).click();
  await expect(page.getByText('Borrador guardado en este dispositivo')).toBeVisible();
  await page.reload();
  await expect(page.locator('.section-heading')).toContainText('10 de octubre de 2026');
  await page.getByRole('button', { name: 'Cómo me siento' }).click();
  await expect(page.getByRole('button', { name: 'Energía: 50%', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Peso y cierre' }).click();
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.locator('.stat-card').filter({ hasText: 'Tu último estado' }).locator('strong')).toHaveText('80%');
});

test('gráficas con huecos de calendario y composición del día, incluidos ceros y respuestas pendientes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar en este dispositivo' }).click();
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  const record = (date: string, answers: Record<string, number>, weight: number | null, notes = '') => ({
    date, answers, activities: {}, productivityMode: 'manual', weight, notes, updatedAt: `${date}T12:00:00Z`,
  });
  const entries = [
    record('2026-10-01', { energy: 1 }, 50),
    record('2026-10-02', {}, null, 'Un día sin mediciones'),
    record('2026-10-03', { energy: 0 }, 52),
    record('2026-10-10', { productivity: .5, energy: 1, thoughts: .25, health: .25 }, 55),
  ];
  await page.getByLabel('Importar Excel o respaldo').setInputFiles({ name: 'historial.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, entries })) });
  await page.getByRole('button', { name: 'Confirmar selección' }).click();
  await page.getByRole('button', { name: 'Progreso', exact: true }).click();

  const moodDots = page.locator('.mood-chart .recharts-area-dot');
  const weightDots = page.locator('.weight-chart .recharts-line-dot');
  await expect(moodDots).toHaveCount(3);
  await expect(weightDots).toHaveCount(3);
  for (const dots of [moodDots, weightDots]) {
    const positions = await dots.evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('cx'))));
    // Dos días hasta el segundo punto; siete días más hasta el último registro.
    expect((positions[2] - positions[1]) / (positions[1] - positions[0])).toBeCloseTo(3.5, 1);
  }
  for (const selector of ['.mood-chart .recharts-area-curve', '.weight-chart .recharts-line-curve']) {
    const path = await page.locator(selector).getAttribute('d');
    expect(path).not.toMatch(/NaN|Infinity/);
    expect(path!.match(/M/g)).toHaveLength(1);
  }

  const composition = page.locator('.composition-chart');
  await expect(composition.getByRole('heading', { name: 'Composición del día' })).toBeVisible();
  await expect(composition.locator('.recharts-pie-sector')).toHaveCount(4);
  await expect(composition.getByText('50%', { exact: true })).toBeVisible();
  await expect(composition.getByText('25%', { exact: true })).toBeVisible();
  await expect(composition.getByText('12.5%', { exact: true })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByLabel('Día del detalle').selectOption('2026-10-03');
  await expect(composition.getByText('Las respuestas de este día están en cero.')).toBeVisible();
  await expect(composition.locator('.recharts-pie-sector')).toHaveCount(0);
  await page.getByLabel('Día del detalle').selectOption('2026-10-02');
  await expect(composition.getByText('Aún no hay respuestas para mostrar la composición.')).toBeVisible();

  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('button', { name: /¿Qué hiciste hoy/ }).click();
  await page.getByRole('button', { name: 'Peso y cierre' }).click();
  await page.getByLabel('¿Cuál es tu peso hoy?').fill('54');
  await page.getByRole('button', { name: 'Guardar mi día', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Hola/ })).toBeVisible();
  await expect(page.locator('.hero')).not.toContainText('Tu día está registrado');
  await expect(page.locator('.hero .status-dot')).toHaveCount(0);
});

test('conserva los GIF animados de portada y menú al recargar', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile('tests/fixtures/animated-background.gif');
  const url = `data:image/gif;base64,${bytes.toString('base64')}`;
  const gif = { name: 'fondo.gif', mimeType: 'image/gif', buffer: bytes };
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar en este dispositivo' }).click();
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  for (const [label, key] of [['Imagen de portada', 'hero'], ['Imagen del menú', 'panel']] as const) {
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('accept', /image\/gif/);
    await page.getByLabel(label, { exact: true }).setInputFiles(gif);
    await expect(page.locator(`.image-preview.${key}`)).toHaveAttribute('style', new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  await page.reload();
  const preview = page.locator('.image-preview.panel');
  await expect(preview).toHaveAttribute('style', /data:image\/gif/);
  const restored = await preview.evaluate(element => element.style.backgroundImage);
  expect(restored).toContain(url); // El archivo entero, con sus dos fotogramas, sigue guardado.
  await page.evaluate(async src => { const image = new Image(); image.src = src; await image.decode(); }, url);
  const firstFrame = (await preview.screenshot()).toString('base64');
  await expect.poll(async () => (await preview.screenshot()).toString('base64')).not.toBe(firstFrame);

  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.locator('.app-background')).toHaveAttribute('style', /data:image\/gif/);
  const cover = page.locator('.hero').filter({ has: page.locator('.hero-content') });
  const coverFrame = (await cover.screenshot({ animations: 'disabled' })).toString('base64');
  await expect.poll(async () => (await cover.screenshot({ animations: 'disabled' })).toString('base64')).not.toBe(coverFrame);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.sidebar.has-image')).toBeVisible();
  expect(await page.locator('.sidebar').evaluate(element => element.style.backgroundImage)).toContain(url);
});

test('Google pendiente se explica sin fingir una sesión', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Continuar con Google' }).click();
  await expect(page.getByRole('dialog')).toContainText('falta conectar esta web con Firebase');
  await page.getByRole('button', { name: 'Entendido' }).click();
  await expect(page.getByRole('button', { name: 'Usar en este dispositivo' })).toBeVisible();
});
