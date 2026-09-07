import PDFDocument from 'pdfkit';
import type { ReportColumn, ReportRow } from './types.js';

const ROW_HEIGHT = 20;
const PAGE_MARGIN = 40;

export function buildPdfTableBuffer(title: string, columns: ReportColumn[], rows: ReportRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - PAGE_MARGIN * 2;
    const totalWeight = columns.reduce((s, c) => s + (c.width ?? 1), 0);
    const colWidths = columns.map((c) => ((c.width ?? 1) / totalWeight) * pageWidth);

    doc.fontSize(14).text(title, { align: 'center' });
    doc.moveDown();

    function drawRow(values: string[], y: number, bold: boolean) {
      let x = PAGE_MARGIN;
      doc.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica');
      values.forEach((v, i) => {
        doc.text(v, x, y, { width: colWidths[i], ellipsis: true });
        x += colWidths[i]!;
      });
    }

    let y = doc.y;
    drawRow(columns.map((c) => c.header), y, true);
    y += ROW_HEIGHT;
    doc
      .moveTo(PAGE_MARGIN, y - 4)
      .lineTo(doc.page.width - PAGE_MARGIN, y - 4)
      .stroke();

    for (const row of rows) {
      if (y > doc.page.height - PAGE_MARGIN) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
      drawRow(
        columns.map((c) => String(row[c.key] ?? '')),
        y,
        false,
      );
      y += ROW_HEIGHT;
    }

    doc.end();
  });
}
