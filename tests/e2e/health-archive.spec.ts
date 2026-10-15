import { expect, test } from '@playwright/test';
import { readdir } from 'node:fs/promises';
import { addInterval, archive, testDatabase, testSql } from '../helpers/health-archive';
import type { HonorArchive } from '../../src/lib/honorHealth';

test('el lector compilado y su WASM leen el ZIP en Chromium y excluyen otras fuentes', async ({ page }) => {
  const SQL = await testSql(), db = testDatabase(SQL);
  addInterval(db, 'steps_record_table', 'count', 1234);
  addInterval(db, 'steps_record_table', 'count', 9999, { id: 2, app: 10 });
  const zip = await archive(db); db.close();
  const worker = (await readdir('dist/assets')).find(name => name.startsWith('healthArchive.worker-') && name.endsWith('.js'))!;
  await page.goto('/');
  const result = await page.evaluate(async ({ bytes, worker }) => {
    return new Promise<HonorArchive>((resolve, reject) => {
      const reader = new Worker('/assets/' + worker, { type: 'module' });
      reader.onmessage = event => { reader.terminate(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.result); };
      reader.onerror = () => { reader.terminate(); reject(new Error('Falló el lector compilado.')); };
      const buffer = new Uint8Array(bytes).buffer; reader.postMessage(buffer, [buffer]);
    });
  }, { bytes: [...new Uint8Array(zip)], worker });
  expect(result.entries).toHaveLength(1); expect(result.entries[0].health.steps).toBe(1234);
  expect(result.ignoredRecords).toBe(1);
});
