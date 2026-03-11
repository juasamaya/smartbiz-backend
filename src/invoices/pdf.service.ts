import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfService {
  async generateInvoicePdf(invoice: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // --- DISEÑO DEL PDF ---
      doc.fillColor('#2563eb').fontSize(20).text(invoice.company.businessName, { align: 'left' });
      doc.fillColor('#444').fontSize(10).text(`NIT: ${invoice.company.nit}`);
      doc.text(invoice.company.address || 'Bogotá, Colombia').moveDown();

      doc.fillColor('#000').fontSize(15).text('FACTURA ELECTRÓNICA', 350, 50, { align: 'right' });
      doc.fontSize(12).text(`${invoice.prefix}${invoice.number}`, { align: 'right' });
      doc.fontSize(10).text(`Fecha: ${new Date(invoice.date).toLocaleDateString()}`, { align: 'right' }).moveDown(2);

      doc.fontSize(12).text('ADQUIRIENTE:', 50, 150);
      doc.fontSize(10).text(invoice.customerName);
      doc.text(`NIT/CC: ${invoice.customerNit}`).moveDown(2);

      // Tabla de productos
      const tableTop = 230;
      doc.fontSize(11).text('Descripción', 50, tableTop);
      doc.text('Cant.', 300, tableTop);
      doc.text('Total', 450, tableTop);
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      let currentHeight = tableTop + 25;
      invoice.items.forEach((item: any) => {
        doc.fontSize(10).text(item.description, 50, currentHeight);
        doc.text(item.quantity.toString(), 300, currentHeight);
        doc.text(`$${Number(item.totalPrice).toLocaleString()}`, 450, currentHeight);
        currentHeight += 20;
      });

      // Totales
      doc.moveTo(350, currentHeight + 10).lineTo(550, currentHeight + 10).stroke();
      doc.fontSize(12).text(`TOTAL: $${Number(invoice.total).toLocaleString()}`, 350, currentHeight + 25, { align: 'right' });

      // CUFE
      doc.fontSize(8).fillColor('#888').text(`CUFE: ${invoice.cufe || 'N/A'}`, 50, 700, { align: 'center' });

      doc.end();
    });
  }
}