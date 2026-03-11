import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor() {
    // Configuración SMTP (Ejemplo con Gmail)
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', // O tu servidor SMTP
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER, // Tu correo (ej: tuempresa@gmail.com)
        pass: process.env.EMAIL_PASS, // Tu contraseña de aplicación (NO la normal)
      },
    });
  }

  async sendInvoice(to: string, customerName: string, invoiceNumber: string, pdfBuffer: Buffer) {
    try {
      const info = await this.transporter.sendMail({
        from: '"SmartBiz Facturación" <noreply@smartbiz.com>', // Remitente
        to: to, // Destinatario
        subject: `Factura Electrónica #${invoiceNumber} - ${customerName}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Hola, ${customerName}</h2>
            <p>Adjunto encontrarás tu factura electrónica número <strong>${invoiceNumber}</strong> generada exitosamente.</p>
            <p>Gracias por tu compra.</p>
            <br>
            <p style="font-size: 12px; color: #888;">Este es un mensaje automático de SmartBiz.</p>
          </div>
        `,
        attachments: [
          {
            filename: `Factura-${invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
          // Aquí podrías agregar el XML también si lo tuvieras en buffer
        ],
      });

      console.log('Correo enviado: %s', info.messageId);
      return true;
    } catch (error) {
      console.error('Error enviando correo:', error);
      return false;
    }
  }
}