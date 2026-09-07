import PDFDocument from 'pdfkit';

export interface CertificateData {
  studentName: string;
  admissionNumber: string;
  courseName: string;
  certificateNumber: string;
  issuedDate: string;
  instituteName: string;
}

export function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.lineWidth(2).rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke();

    doc.moveDown(2);
    doc.fontSize(24).text('Certificate of Completion', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(data.instituteName, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).text('This is to certify that', { align: 'center' });
    doc.moveDown();
    doc.fontSize(20).text(data.studentName, { align: 'center' });
    doc.fontSize(10).text(`Admission No: ${data.admissionNumber}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('has successfully completed the course', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text(data.courseName, { align: 'center' });

    doc.moveDown(3);
    doc.fontSize(10);
    doc.text(`Certificate No: ${data.certificateNumber}`, 80, doc.page.height - 100);
    doc.text(`Date: ${data.issuedDate}`, doc.page.width - 200, doc.page.height - 100);

    doc.end();
  });
}
