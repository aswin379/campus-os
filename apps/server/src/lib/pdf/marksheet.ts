import PDFDocument from 'pdfkit';

export interface MarksheetData {
  studentName: string;
  admissionNumber: string;
  courseName: string;
  batchName: string;
  marks: { componentName: string; maxMarks: number; marksObtained: number | null }[];
  totalPercentage: number | null;
  resultStatus: string;
  instituteName: string;
}

const ROW_HEIGHT = 18;
const CELL_PADDING_RIGHT = 6;
const TABLE_FONT_SIZE = 10;

// [x-weight, header, align] — Component gets more room than the two number
// columns. Weights are resolved against the page's actual content width
// below rather than hardcoded x positions: A5 (419.53pt) is much narrower
// than the A4 the original 40/250/350 offsets assumed, which left the
// "Obtained" column only ~30pt before the right margin — barely enough for
// its own header, let alone a 3-digit mark, and long component names had
// nothing stopping them from running straight into the numbers next to them.
const COLUMNS: { weight: number; header: string; align: 'left' | 'right' }[] = [
  { weight: 2.2, header: 'Component', align: 'left' },
  { weight: 1, header: 'Max Marks', align: 'right' },
  { weight: 1, header: 'Obtained', align: 'right' },
];

export function generateMarksheetPdf(data: MarksheetData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const totalWeight = COLUMNS.reduce((s, c) => s + c.weight, 0);
    const colWidths = COLUMNS.map((c) => (c.weight / totalWeight) * contentWidth);
    const colX = colWidths.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? left : acc[i - 1]! + colWidths[i - 1]!], []);
    // Same fix as the tabular report export: `ellipsis` only truncates a
    // cell when `height` is also given, otherwise an overlong value wraps
    // onto a second line that the next fixed-height row then overlaps.
    const cellHeight = doc.fontSize(TABLE_FONT_SIZE).currentLineHeight(true) * 1.4;

    doc.fontSize(16).text(data.instituteName, { align: 'center' });
    doc.fontSize(10).text('Mark Sheet', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Student: ${data.studentName} (${data.admissionNumber})`);
    doc.text(`Course: ${data.courseName}`);
    doc.text(`Batch: ${data.batchName}`);
    doc.moveDown();

    function drawRow(values: string[], y: number, bold: boolean): void {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(TABLE_FONT_SIZE);
      values.forEach((v, i) => {
        doc.text(v, colX[i]!, y, {
          width: colWidths[i]! - CELL_PADDING_RIGHT,
          height: cellHeight,
          ellipsis: true,
          align: COLUMNS[i]!.align,
        });
      });
    }

    function drawHeaderRow(y: number): void {
      drawRow(COLUMNS.map((c) => c.header), y, true);
      doc
        .moveTo(left, y + ROW_HEIGHT - 4)
        .lineTo(left + contentWidth, y + ROW_HEIGHT - 4)
        .stroke();
    }

    let y = doc.y;
    drawHeaderRow(y);
    y += ROW_HEIGHT;

    for (const m of data.marks) {
      if (y + ROW_HEIGHT > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeaderRow(y);
        y += ROW_HEIGHT;
      }
      drawRow([m.componentName, String(m.maxMarks), m.marksObtained === null ? '—' : String(m.marksObtained)], y, false);
      y += ROW_HEIGHT;
    }

    // pdfkit's text() with an explicit x argument leaves doc.x pinned there
    // for every call after — the loop's last cell was the right-hand
    // "Obtained" column, so without resetting this back to the margin, the
    // lines below would start from that narrow leftover position and wrap
    // "Total Percentage: ..." across several lines instead of printing on one.
    doc.x = left;
    doc.y = y;
    doc.moveDown(2);
    doc.fontSize(12);
    doc.text(`Total Percentage: ${data.totalPercentage === null ? 'Not yet computed' : `${data.totalPercentage}%`}`);
    doc.text(`Result: ${data.resultStatus.toUpperCase()}`);

    doc.end();
  });
}
