import PDFDocument from 'pdfkit';
import { env } from '../../config/env.js';

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
}

export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(data.instituteName, { align: 'center' });
    if (data.instituteAddress) doc.fontSize(9).text(data.instituteAddress, { align: 'center' });
    doc.fontSize(10).text('Fee Receipt', { align: 'center' });
    doc.moveDown();

    if (data.transactionType === 'void') {
      doc.fillColor('red').fontSize(12).text('VOID / ADJUSTMENT ENTRY', { align: 'center' }).fillColor('black');
      if (data.originalReceiptNumber) {
        doc.fontSize(10).text(`Reverses Receipt No: ${data.originalReceiptNumber}`, { align: 'center' });
      }
      doc.moveDown();
    }

    doc.fontSize(10);
    doc.text(`Receipt No: ${data.receiptNumber}`);
    doc.text(`Date: ${data.paymentDate}`);
    doc.moveDown();
    doc.text(`Student: ${data.studentName} (${data.admissionNumber})`);
    doc.text(`Course: ${data.courseName}`);
    doc.text(`Batch: ${data.batchName}`);
    doc.moveDown();
    doc.text(`Payment Mode: ${data.paymentMode}`);
    if (data.notes) doc.text(`Notes: ${data.notes}`);
    doc.moveDown();
    doc.fontSize(14).text(`Amount: Rs. ${data.amount.toFixed(2)}`, { align: 'right' });

    doc.moveDown(2);
    if (data.termsText) doc.fontSize(8).text(data.termsText, { align: 'center' });
    doc.fontSize(8).text(env.APP_BASE_URL, { align: 'center' });

    doc.end();
  });
}
