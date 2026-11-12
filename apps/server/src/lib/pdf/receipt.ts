import PDFDocument from 'pdfkit';

export interface ReceiptData {
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  transactionType: string;
  notes: string | null;
  studentName: string;
  admissionNumber: string;
  courseName: string;
  batchName: string;
  instituteName: string;
  instituteAddress: string;
  termsText: string;
  /** Set only for a void/adjustment entry — the receipt number of the payment it reverses. */
  originalReceiptNumber?: string | null;
  /** Institute logo, when one is configured in Settings — omitted/null prints the header without one. */
  logoBuffer?: Buffer | null;
}

const LABEL_WIDTH = 90;

export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    /** A label/value line with a fixed-width bold label column, so every field lines up on the same left edge. */
    function row(label: string, value: string): void {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).text(label, left, y, { width: LABEL_WIDTH });
      const valueHeight = doc.font('Helvetica').fontSize(9).heightOfString(value, { width: contentWidth - LABEL_WIDTH });
      doc.text(value, left + LABEL_WIDTH, y, { width: contentWidth - LABEL_WIDTH });
      doc.y = y + Math.max(valueHeight, 14);
    }

    function divider(): void {
      doc.moveTo(left, doc.y).lineTo(left + contentWidth, doc.y).strokeColor('#cccccc').stroke().strokeColor('black');
    }

    // --- Header: logo, then institute name and address centered below it ---
    if (data.logoBuffer) {
      // doc.image() only decodes JPEG/PNG — a WebP logo (allowed by the settings
      // upload) would throw here, so this must never take down receipt generation.
      // `fit` bounds the drawn size to a known box regardless of the source image's
      // aspect ratio, so the gap below it can be a fixed, reliable value instead of
      // a guess (a guess is what let the name sit right up against — sometimes
      // overlapping — the logo before).
      try {
        const boxSize = 55;
        const startY = doc.y;
        doc.image(data.logoBuffer, (doc.page.width - boxSize) / 2, startY, { fit: [boxSize, boxSize], align: 'center' });
        doc.y = startY + boxSize + 10;
      } catch {
        // Unsupported/corrupt image — fall through and print the text header alone.
      }
    }
    doc.font('Helvetica-Bold').fontSize(16).text(data.instituteName, { align: 'center' });
    if (data.instituteAddress) {
      doc.font('Helvetica').fontSize(9).fillColor('#555555').text(data.instituteAddress, { align: 'center' }).fillColor('black');
    }
    doc.moveDown(0.5);
    divider();
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11).text('FEE RECEIPT', { align: 'center' });
    doc.moveDown(0.8);

    if (data.transactionType === 'void') {
      doc.fillColor('red').font('Helvetica-Bold').fontSize(11).text('VOID / ADJUSTMENT ENTRY', { align: 'center' });
      doc.fillColor('black');
      if (data.originalReceiptNumber) {
        doc.font('Helvetica').fontSize(9).text(`Reverses Receipt No: ${data.originalReceiptNumber}`, { align: 'center' });
      }
      doc.moveDown(0.8);
    }

    // --- Transaction details: a clean two-column grid, every row aligned to the same label/value edges ---
    row('Receipt No', data.receiptNumber);
    row('Date', data.paymentDate);
    doc.moveDown(0.4);
    row('Student', data.studentName);
    row('Admission No', data.admissionNumber);
    row('Course', data.courseName);
    row('Batch', data.batchName);
    doc.moveDown(0.4);
    row('Payment Mode', data.paymentMode);
    if (data.notes) row('Notes', data.notes);

    doc.moveDown(0.6);
    divider();
    doc.moveDown(0.5);
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(`Amount Paid: Rs. ${data.amount.toFixed(2)}`, left, doc.y, { width: contentWidth, align: 'right' });

    // --- Footer: pinned to the bottom of the page (not just "after the content"),
    // so it lands in the same place regardless of how much the details above fill
    // the page — falling back to flowing right after the content on the rare
    // receipt with enough notes/lines to reach this far down already.
    const footerLineHeight = 11;
    const footerHeight = (data.termsText ? 2 : 1) * footerLineHeight;
    let footerY = doc.page.height - doc.page.margins.bottom - footerHeight;
    footerY = Math.max(footerY, doc.y + 20);

    if (data.termsText) {
      doc.font('Helvetica').fontSize(8).fillColor('#555555').text(data.termsText, left, footerY, { width: contentWidth, align: 'center' });
      doc.fillColor('black');
      footerY += footerLineHeight;
    }
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#888888')
      .text('CampusOs - Made by UNIK', left, footerY, { width: contentWidth, align: 'center' });
    doc.fillColor('black');

    doc.end();
  });
}
