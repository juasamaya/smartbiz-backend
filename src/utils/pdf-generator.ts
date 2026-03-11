import PDFDocument from 'pdfkit';

export async function generateInvoicePDF(invoice: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // 1. Crear documento en memoria
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: Buffer[] = [];

    // 2. Capturar los datos en el buffer (no en disco)
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    // --- DISEÑO DE LA FACTURA ---
    
    // Encabezado
    doc.fontSize(20).text('FACTURA ELECTRÓNICA', { align: 'center' });
    doc.moveDown();
    
    // Datos de la empresa (Mockup o reales si los tienes)
    doc.fontSize(10).text('SmartBiz Technology S.A.S');
    doc.text('NIT: 900.123.456-7');
    doc.moveDown();

    // Datos de la Factura
    doc.text(`Número: ${invoice.prefix || 'FE'}-${invoice.number}`);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`);
    doc.text(`Cliente: ${invoice.customerName}`);
    doc.text(`Email: ${invoice.customerEmail || 'N/A'}`);
    doc.moveDown();

    // Línea separadora
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Totales
    doc.fontSize(14).text(`Total a Pagar: $${Number(invoice.total).toLocaleString('es-CO')}`, { align: 'right' });
    
    // Finalizar PDF
    doc.end();
  });
}