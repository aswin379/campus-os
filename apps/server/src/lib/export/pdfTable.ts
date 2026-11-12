import PDFDocument from 'pdfkit';
import type { ReportColumn, ReportRow } from './types.js';

const ROW_HEIGHT = 20;
const CELL_PADDING_RIGHT = 6;
const PAGE_MARGIN = 40;
const FONT_SIZE = 9;

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
    // pdfkit's `ellipsis` option only truncates a cell when a `height` is also
    // given — without one, a value too wide for its column wraps onto a second
    // line instead, which every row below then renders on top of (since each
    // row's y position advances by a fixed ROW_HEIGHT regardless of how many
    // lines the previous one actually took). Capping height to a bit more than
    // one line forces exactly one line per cell, truncated with "…" instead.
    const cellHeight = doc.fontSize(FONT_SIZE).currentLineHeight(true) * 1.4;

    doc.fontSize(14).text(title, { align: 'center' });
    doc.moveDown();

    function drawRow(values: string[], y: number, bold: boolean): void {
      let x = PAGE_MARGIN;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE);
      values.forEach((v, i) => {
        doc.text(v, x, y, { width: colWidths[i]! - CELL_PADDING_RIGHT, height: cellHeight, ellipsis: true });
        x += colWidths[i]!;
      });
    }

    function drawHeaderRow(y: number): void {
      drawRow(columns.map((c) => c.header), y, true);
      doc
        .moveTo(PAGE_MARGIN, y + ROW_HEIGHT - 4)
        .lineTo(doc.page.width - PAGE_MARGIN, y + ROW_HEIGHT - 4)
        .stroke();
    }

    let y = doc.y;
    drawHeaderRow(y);
    y += ROW_HEIGHT;

    for (const row of rows) {
      if (y + ROW_HEIGHT > doc.page.height - PAGE_MARGIN) {
        doc.addPage();
        y = PAGE_MARGIN;
        drawHeaderRow(y);
        y += ROW_HEIGHT;
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
