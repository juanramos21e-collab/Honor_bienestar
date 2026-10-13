import { Workbook } from 'exceljs';
import { describe, expect, it } from 'vitest';
import { importExcel } from '../src/lib/files';
import { moodScore } from '../src/lib/model';

async function workbook(rows: unknown[][], activities = false): Promise<ArrayBuffer> {
  const book = new Workbook(); const sheet = book.addWorksheet('Estado_Animo');
  sheet.addRow(['N', 'Fecha', 'Productibidad ', 'Energia ', 'Pass_think', 'Proyectos  mios', 'Proyectos - trabajos Uni', 'Salud', 'Heartache', 'EStado de animo', 'Porcentaje de estado', 'Peso']);
  for (const row of rows) sheet.addRow(row);
  if (activities) {
    const s = book.addWorksheet('Productividad');
    s.getRow(30).values = ['Fecha', { formula: 'B7', result: 'Meditar' }, 'Leer', 'Limpieza_orden', 'Proyectos_U', 'Proyectos_P', 'Aprender', 'Pendiente_apoyo_Tram', 'Cronograma_100%', 'Gym', 'Productividad'];
    s.getRow(31).values = [new Date('2026-10-11T00:00:00Z'), 0, 1, 0, 0, 1, 0, 1, 0, 0, { formula: 'SUMPRODUCT(B29:J29,B31:J31)', result: .45 }];
  }
  const buffer = await book.xlsx.writeBuffer(); return buffer as unknown as ArrayBuffer;
}
describe('Importación del Excel original', () => {
  it('limpia los encabezados, lee resultados de fórmulas y conserva el peso', async () => {
    const data = await importExcel(await workbook([[1, new Date('2026-10-11T00:00:00Z'), { formula: 'Productividad!K31', result: .45 }, 1, .7, .6, .5, 1, .3, 2.55, .85, 54.3]], true));
    expect(data).toHaveLength(1); expect(data[0].date).toBe('2026-10-11'); expect(data[0].weight).toBe(54.3);
    expect(data[0].answers.productivity).toBe(.45); expect(data[0].activities.personal).toBe(1); expect(data[0].activities.help).toBe(1);
    expect(data[0].productivityMode).toBe('manual'); expect(moodScore(data[0])).toBeCloseTo(.85);
  });
  it('no fabrica registros para las fórmulas en filas futuras vacías', async () => {
    const data = await importExcel(await workbook([[1, '2026-10-11', { formula: 'Productividad!K31', result: 0 }, null, null, null, null, null, null, 0, 0, null], [2, '2026-10-12', 0, null, null, null, null, null, null, 0, 0, 54.3]]));
    expect(data).toHaveLength(1); expect(data[0].date).toBe('2026-10-12'); expect(moodScore(data[0])).toBeNull();
  });
  it('rechaza fórmulas sin resultados guardados en vez de convertirlas en cero', async () => {
    await expect(importExcel(await workbook([[1, '2026-10-11', { formula: 'Productividad!K31' }, 1]]))).rejects.toThrow('fórmula sin resultado');
  });
  it('conserva ceros explícitos y admite fechas y decimales en español', async () => {
    const data = await importExcel(await workbook([[1, '11/10/2026', 0, 0, 0, 0, 0, 0, 0, 0, 0, '54,3']]));
    expect(data).toHaveLength(1); expect(moodScore(data[0])).toBe(0); expect(data[0].weight).toBe(54.3);
  });
});
