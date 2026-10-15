import { expect, test, type Page } from '@playwright/test';

async function enterForm(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Usar en este dispositivo' }).click();
  await page.getByRole('button', { name: /¿Qué hiciste hoy/ }).click();
}
async function mockCall(page: Page, code: string) { return page.evaluate(code); }
async function turn(page: Page, answer: string) {
  await expect(page.locator('.voice-turn')).toHaveClass(/speaking/);
  await mockCall(page, 'window.__voice.finishReading()');
  await expect(page.locator('.voice-turn')).toHaveClass(/cue/);
  await mockCall(page, 'window.__voice.finishCue()');
  await expect(page.locator('.voice-turn')).toHaveClass(/listening/);
  await page.evaluate(text => (window as unknown as { __voice: { answer: (text: string) => void } }).__voice.answer(text), answer);
}

test('salud: validar, recuperar borrador, graficar y exportar sin perder métricas', async ({ page }) => {
  await enterForm(page);
  await page.getByRole('button', { name: 'Peso y cierre' }).click();
  await page.getByText('Datos de mi reloj · opcional', { exact: true }).click();
  await page.getByLabel('Pasos', { exact: true }).fill('8000');
  await page.getByLabel('Sueño total', { exact: true }).fill('7,5');
  await page.getByLabel('Sueño profundo', { exact: true }).fill('8');
  await expect(page.getByRole('alert')).toContainText('fases de sueño');
  await expect(page.getByRole('button', { name: 'Guardar mi día', exact: true })).toBeDisabled();
  await page.getByLabel('Sueño profundo', { exact: true }).fill('2');
  await page.getByLabel('Oxígeno en sangre (SpO₂)', { exact: true }).fill('98');
  await expect(page.getByText('Borrador guardado en este dispositivo')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Peso y cierre' }).click();
  await page.getByText('Datos de mi reloj · opcional', { exact: true }).click();
  await expect(page.getByLabel('Pasos', { exact: true })).toHaveValue('8000');
  await expect(page.getByLabel('Sueño total', { exact: true })).toHaveValue('7.5');
  await page.getByRole('button', { name: 'Guardar mi día', exact: true }).click();
  await page.getByRole('button', { name: 'Progreso', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salud y actividad' })).toBeVisible();
  await expect(page.locator('.health-progress .recharts-line-dot')).toHaveCount(1);
  await expect(page.locator('.health-progress')).toContainText('7.5');
  await page.getByLabel('Evolución de salud', { exact: true }).selectOption('sleepHours');
  await expect(page.locator('.health-progress .recharts-line-dot')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Descargar respaldo/ }).click();
  const download = await downloadPromise; const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.entries[0].health).toEqual({ steps: 8000, sleepHours: 7.5, deepSleepHours: 2, spo2: 98 });
  const excelDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar a Excel', exact: true }).click();
  const excel = await excelDownload; const excelStream = await excel.createReadStream();
  const excelChunks = []; for await (const chunk of excelStream!) excelChunks.push(chunk);
  const bytes = Buffer.concat(excelChunks);
  await page.getByLabel('Importar Excel o respaldo').setInputFiles({ name: 'reloj.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bytes });
  await page.getByRole('radio', { name: /Archivo importado/ }).check();
  await page.getByRole('button', { name: 'Confirmar selección' }).click();
  const roundTripDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar respaldo', exact: true }).click();
  const roundTrip = await roundTripDownload; const { readFile } = await import('node:fs/promises');
  const restored = JSON.parse(await readFile((await roundTrip.path())!, 'utf8'));
  expect(restored.entries[0].health).toEqual(backup.entries[0].health);
});

test('voz breve con reloj: guarda métricas, decimales y apuntes tras confirmación explícita', async ({ page }) => {
  await page.addInitScript({ path: 'tests/fixtures/voice-browser.js' }); await enterForm(page);
  await page.getByLabel('Lectura', { exact: true }).selectOption('short');
  await page.getByLabel('Incluir las preguntas de mi reloj').check();
  await page.getByRole('button', { name: 'Comenzar por voz' }).click();
  for (let i = 0; i < 9; i++) await turn(page, 'no');
  expect(await mockCall(page, 'window.__voice.utterances.at(-1)')).toContain('Responde nada, poco, medio, bastante o mucho. Pregunta 10.');
  for (let i = 0; i < 6; i++) await turn(page, 'medio');
  expect(await mockCall(page, 'window.__voice.utterances.at(-1)')).toContain('Di únicamente tu peso en kilogramos. Pregunta 16.');
  await turn(page, '54,3');
  for (const answer of ['ocho mil', 'cinco', '300', 'cuarenta', '75', 'sesenta', '98%', 'siete horas treinta minutos', 'dos', 'cuatro', 'uno coma cinco', 'treinta']) await turn(page, answer);
  await turn(page, 'Hoy me siento tranquilo y descansé mejor.');
  await turn(page, 'guardar');
  await expect(page.getByRole('heading', { name: /Hola/ })).toBeVisible();
  await page.getByRole('button', { name: /Revisa cómo va tu día/ }).click();
  await page.getByRole('button', { name: 'Peso y cierre' }).click();
  await page.getByText('Datos de mi reloj · opcional', { exact: true }).click();
  await expect(page.getByLabel('Pasos', { exact: true })).toHaveValue('8000');
  await expect(page.getByLabel('Sueño total', { exact: true })).toHaveValue('7.5');
  await expect(page.getByLabel('Oxígeno en sangre (SpO₂)', { exact: true })).toHaveValue('98');
  await expect(page.getByLabel('Algo que quieras recordar')).toHaveValue('Hoy me siento tranquilo y descansé mejor.');
  expect(await mockCall(page, 'window.__voice.overlap')).toBe(false);
});

test('voz completa: espera lectura y señal, responde todo, dicta apuntes y revisa', async ({ page }) => {
  await page.addInitScript({ path: 'tests/fixtures/voice-browser.js' }); await enterForm(page);
  await page.getByLabel('Incluir las preguntas de mi reloj').uncheck();
  await page.getByRole('button', { name: 'Comenzar por voz' }).click();
  await expect(page.locator('.voice-answer-hint')).toHaveText('Responde solo «sí» o «no».');
  await expect(page.getByLabel('Escala de respuestas')).toHaveCount(0);
  expect(await mockCall(page, 'window.__voice.recognitionStarts')).toBe(0);
  expect(await mockCall(page, 'window.__voice.utterances[0]')).toContain('meditar');
  await mockCall(page, 'window.__voice.finishReading()');
  expect(await mockCall(page, 'window.__voice.recognitionStarts')).toBe(0);
  await mockCall(page, 'window.__voice.finishCue()');
  await expect(page.getByRole('group', { name: 'Meditar u orar' }).getByRole('button', { name: 'Sí', exact: true })).toBeDisabled();
  await mockCall(page, 'window.__voice.answer("sí")');
  for (let i = 1; i < 9; i++) await turn(page, 'no');
  expect(await mockCall(page, 'window.__voice.utterances.at(-1)')).toContain('Responde nada, poco, medio, bastante o mucho.');
  await expect(page.locator('.voice-answer-hint')).toHaveText('Responde «nada», «poco», «medio», «bastante» o «mucho».');
  await turn(page, 'cinco'); // Los números no sustituyen las palabras del estado.
  await expect(page.locator('.voice-counter')).toHaveText('Pregunta 10 de 18');
  expect(await mockCall(page, 'window.__voice.utterances.at(-1)')).toContain('«nada», «poco», «medio», «bastante» o «mucho»');
  for (const answer of ['nada', 'poco', 'medio', 'bastante', 'mucho', 'medio']) await turn(page, answer);
  await expect(page.locator('.voice-answer-hint')).toContainText('peso en kilogramos');
  expect(await mockCall(page, 'window.__voice.utterances.at(-1)')).toContain('Ahora, el peso. Di únicamente tu peso en kilogramos.');
  await turn(page, 'mucho');
  await expect(page.locator('.voice-counter')).toHaveText('Pregunta 16 de 18');
  expect(await mockCall(page, 'window.__voice.utterances.at(-1)')).toContain('peso en kilogramos');
  await mockCall(page, 'window.__voice.finishReading(); window.__voice.finishCue(); window.__voice.answerInterim("54")');
  await expect(page.locator('.voice-turn')).toHaveClass(/paused/);
  await expect(page.getByLabel('¿Cuál es tu peso hoy?')).toHaveValue('');
  await page.getByRole('button', { name: 'Continuar por voz', exact: true }).click();
  await turn(page, 'cincuenta y cuatro coma tres');
  await expect(page.locator('.voice-card h3')).toContainText('¿Cómo te sientes hoy?');
  await mockCall(page, 'window.__voice.finishReading(); window.__voice.finishCue(); window.__voice.answer("Hoy caminé.", "Me siento con ánimo.")');
  await turn(page, 'revisar');
  await expect(page.getByLabel('Algo que quieras recordar')).toHaveValue('Hoy caminé. Me siento con ánimo.');
  await expect(page.getByLabel('¿Cuál es tu peso hoy?')).toHaveValue('54.3');
  await page.getByRole('button', { name: 'Cómo me siento', exact: true }).click();
  for (const [label, value] of [['Energía', '0'], ['Pensamientos que quitan paz', '25'], ['Proyectos personales', '50'], ['Proyectos universitarios', '75'], ['Salud', '100'], ['Dolor físico o emocional', '50']]) {
    const row = page.locator('.question').filter({ has: page.getByRole('button', { name: `${label}: ${value}%`, exact: true }) });
    await expect(row.getByLabel('Valor exacto (%)')).toHaveValue(value);
  }
  await page.getByRole('button', { name: 'Peso y cierre' }).click();
  expect(await mockCall(page, 'window.__voice.overlap')).toBe(false);
  expect(await mockCall(page, 'window.__voice.activeRecognition')).toBeNull();
  await page.getByRole('button', { name: 'Guardar mi día', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Hola/ })).toBeVisible();
});

test('voz breve: pausa cierra micrófono, ignora señales antiguas y permite reintentar permiso', async ({ page }) => {
  await page.addInitScript({ path: 'tests/fixtures/voice-browser.js' }); await enterForm(page);
  await page.getByLabel('Lectura', { exact: true }).selectOption('short');
  await page.getByRole('button', { name: 'Comenzar por voz' }).click();
  expect(await mockCall(page, 'window.__voice.utterances[0]')).toBe('Primera parte: tus actividades. Responde solo sí o no. Pregunta 1.');
  await mockCall(page, 'window.__voice.finishReading()');
  await page.getByRole('button', { name: 'Pausar voz' }).click();
  await mockCall(page, 'window.__voice.finishCue()');
  expect(await mockCall(page, 'window.__voice.recognitionStarts')).toBe(0);
  await page.getByRole('button', { name: 'Continuar por voz' }).click();
  await mockCall(page, 'window.__voice.finishReading(); window.__voice.finishCue(); window.__voice.error("not-allowed")');
  await expect(page.locator('.voice-turn')).toContainText('Permite el micrófono');
  expect(await mockCall(page, 'window.__voice.activeRecognition')).toBeNull();
  await page.getByRole('button', { name: 'Continuar por voz' }).click();
  await turn(page, 'cinco');
  await expect(page.locator('.voice-counter')).toHaveText('Pregunta 1 de 18');
  expect(await mockCall(page, 'window.__voice.utterances.at(-1)')).toBe('No entendí la respuesta. Responde solo «sí» o «no».');
  await mockCall(page, 'window.__voice.finishReading(); window.__voice.finishCue(); window.__voice.answerInterim("Sí.")');
  await expect(page.locator('.voice-counter')).toHaveText('Pregunta 2 de 18');
  expect(await mockCall(page, 'window.__voice.utterances.at(-1)')).toBe('Pregunta 2.');
  await page.getByRole('button', { name: 'Terminar voz y revisar' }).click();
  expect(await mockCall(page, 'window.__voice.activeRecognition')).toBeNull();
  expect(await mockCall(page, 'window.__voice.speechActive')).toBe(false);
  await expect(page.getByRole('group', { name: 'Meditar u orar' }).getByRole('button', { name: 'Sí', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
