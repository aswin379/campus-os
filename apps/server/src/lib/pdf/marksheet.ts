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

export function generateMarksheetPdf(data: MarksheetData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(data.instituteName, { align: 'center' });
    doc.fontSize(10).text('Mark Sheet', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Student: ${data.studentName} (${data.admissionNumber})`);
    doc.text(`Course: ${data.courseName}`);
    doc.text(`Batch: ${data.batchName}`);
    doc.moveDown();

    let y = doc.y;
    doc.font('Helvetica-Bold');
    doc.text('Component', 40, y);
    doc.text('Max Marks', 250, y);
    doc.text('Obtained', 350, y);
    doc.font('Helvetica');
    y += 18;
    doc
      .moveTo(40, y - 4)
      .lineTo(doc.page.width - 40, y - 4)
      .stroke();

    for (const m of data.marks) {
      doc.text(m.componentName, 40, y);
      doc.text(String(m.maxMarks), 250, y);
      doc.text(m.marksObtained === null ? '—' : String(m.marksObtained), 350, y);
      y += 18;
    }

    doc.moveDown(2);
    doc.fontSize(12);
    doc.text(`Total Percentage: ${data.totalPercentage === null ? 'Not yet computed' : `${data.totalPercentage}%`}`);
    doc.text(`Result: ${data.resultStatus.toUpperCase()}`);

    doc.end();
  });
}
