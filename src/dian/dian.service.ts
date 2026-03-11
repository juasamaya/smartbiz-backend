import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { PrismaService } from 'prisma/prisma.service';
import * as fs from 'fs';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { SignerService } from './signer.service';

@Injectable()
export class DianService {
  constructor(
    private prisma: PrismaService,
    private signerService: SignerService
  ) {}

  // --- MOCK DASHBOARD ---
  async getAcquirer(docType: string, nit: string, companyId?: string) {
    console.log(`🔎 Consultando estado DIAN para ${docType} - ${nit}`);
    return {
      identificationType: docType,
      identificationNumber: nit,
      name: "Usuario Simulado DIAN",
      status: "HABILITADO",
      lastUpdate: new Date()
    };
  }

  // --- PROCESO PRINCIPAL ---
  async generateInvoiceXML(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { company: true, items: true },
    });

    if (!invoice) throw new Error('Factura no encontrada');

    // 1. Calcular CUFE
    const cufe = this.calculateCUFE(invoice);

    // Actualizar factura en BD
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { cufe: cufe }
    });

    // 2. Construir XML Base
    const xml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Invoice', {
        'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        'xmlns:sts': 'dian:gov:co:facturaelectronica:Structures-2-1',
      })
      
      // Extensiones (Placeholder para la firma)
      .ele('ext:UBLExtensions').ele('ext:UBLExtension')
        .ele('ext:ExtensionContent').txt('').up()
      .up().up()

      // Encabezado
      .ele('cbc:UBLVersionID').txt('UBL 2.1').up()
      .ele('cbc:CustomizationID').txt('10').up()
      .ele('cbc:ProfileID').txt('DIAN 2.1: Factura Electrónica de Venta').up()
      .ele('cbc:ID').txt(`${invoice.prefix}${invoice.number}`).up()
      .ele('cbc:UUID', { schemeName: 'CUFE-SHA384' }).txt(cufe).up()
      .ele('cbc:IssueDate').txt(invoice.date.toISOString().split('T')[0]).up()
      .ele('cbc:IssueTime').txt(invoice.date.toISOString().split('T')[1].split('.')[0] + '-05:00').up()
      .ele('cbc:InvoiceTypeCode').txt('01').up()
      
      // Datos Emisor
      .ele('cac:AccountingSupplierParty')
        .ele('cac:Party')
          .ele('cac:PartyTaxScheme')
            .ele('cbc:RegistrationName').txt(invoice.company.businessName).up()
            .ele('cbc:CompanyID', { schemeName: '31' }).txt(invoice.company.nit).up()
            .ele('cac:TaxScheme').ele('cbc:ID').txt('01').up().ele('cbc:Name').txt('IVA').up().up()
          .up()
        .up()
      .up()

      // Datos Receptor
      .ele('cac:AccountingCustomerParty')
        .ele('cac:Party')
          .ele('cac:PartyTaxScheme')
            .ele('cbc:RegistrationName').txt(invoice.customerName).up()
            .ele('cbc:CompanyID', { schemeName: '13' }).txt(invoice.customerNit).up()
             .ele('cac:TaxScheme').ele('cbc:ID').txt('01').up().ele('cbc:Name').txt('IVA').up().up()
          .up()
        .up()
      .up();

    // 3. Agregar Productos
    invoice.items.forEach((item, index) => {
      xml.ele('cac:InvoiceLine')
        .ele('cbc:ID').txt((index + 1).toString()).up()
        .ele('cbc:InvoicedQuantity', { unitCode: '94' }).txt(item.quantity.toString()).up()
        .ele('cbc:LineExtensionAmount', { currencyID: 'COP' }).txt(Number(item.totalPrice).toFixed(2)).up()
        .ele('cac:Item')
          .ele('cbc:Description').txt(item.description).up()
        .up()
        .ele('cac:Price')
          .ele('cbc:PriceAmount', { currencyID: 'COP' }).txt(Number(item.unitPrice).toFixed(2)).up()
        .up()
      .up();
    });

    // 4. Agregar Totales
    xml.ele('cac:LegalMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: 'COP' }).txt(Number(invoice.subtotal).toFixed(2)).up()
      .ele('cbc:TaxExclusiveAmount', { currencyID: 'COP' }).txt(Number(invoice.tax).toFixed(2)).up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: 'COP' }).txt(Number(invoice.total).toFixed(2)).up()
      .ele('cbc:PayableAmount', { currencyID: 'COP' }).txt(Number(invoice.total).toFixed(2)).up()
    .up();
    
    // Generar String XML sin firmar
    const rawXml = xml.end({ prettyPrint: true });
    let finalXml = rawXml;

    // 5. FIRMA DIGITAL (XAdES-BES)
    console.log('✍️ Firmando XML...');
    if (invoice.company.certificatePath && invoice.company.certificatePass) {
        try {
            finalXml = this.signerService.signXML(
                rawXml, 
                invoice.company.certificatePath, 
                invoice.company.certificatePass
            );
            console.log('✅ XML Firmado exitosamente');

            await this.prisma.invoice.update({
               where: { id: invoiceId },
               data: { dianStatus: 'SIGNED' }
            });

        } catch (error) {
            console.error('❌ Error firmando XML:', error);
        }
    } else {
        console.warn('⚠️ No hay certificado configurado, el XML quedará sin firma.');
    }

    // 6. Guardar archivo en disco
    if (!fs.existsSync('./invoices')) {
      fs.mkdirSync('./invoices');
    }
    
    const fileName = `fac-${invoice.prefix}${invoice.number}`;
    const filePath = `./invoices/${fileName}.xml`;
    fs.writeFileSync(filePath, finalXml);
    console.log(`✅ Archivo guardado: ${filePath}`);

    // 7. ENVIAR A LA DIAN (NUEVO)
    // Usamos el ID de la base de datos O un ID falso para probar conexión
    const testSetId = invoice.company.testSetId || "1111-2222-3333-4444"; 

    if (testSetId) {
        console.log(`📡 Intentando enviar a DIAN (TestSetId: ${testSetId})...`);
        try {
            const dianResponse = await this.sendToDian(filePath, fileName, testSetId);
            console.log('✅ RESPUESTA DIAN:', JSON.stringify(dianResponse, null, 2));
            
            // Actualizar estado a ENVIADO
            await this.prisma.invoice.update({
                where: { id: invoiceId },
                data: { dianStatus: 'SENT' } 
            });

        } catch (error) {
            // Es normal que falle aquí si el certificado es de prueba o el TestSetId es falso
            console.error('⚠️ El envío a la DIAN falló (Posiblemente por credenciales de prueba).');
        }
    }

    return { xmlString: finalXml, cufe };
  }

  // --- LÓGICA DE CÁLCULO CUFE ---
  private calculateCUFE(invoice: any): string {
    const company = invoice.company;
    
    const date = invoice.date.toISOString().split('T')[0];
    const time = invoice.date.toISOString().split('T')[1].split('.')[0] + '-05:00';
    
    const valFac = Number(invoice.subtotal).toFixed(2);
    const valImp1 = Number(invoice.tax).toFixed(2);
    const valImp2 = '0.00';
    const valImp3 = '0.00';
    const valPag = Number(invoice.total).toFixed(2);
    
    const clTec = company.technicalKey || "fc8eac422eba16e22ffd8c6f94b3f40a6e38162c"; 
    const tipoAmb = company.environment || "2";

    const rawData = `${invoice.prefix}${invoice.number}${date}${time}${valFac}01${valImp1}04${valImp2}03${valImp3}${valPag}${company.nit}${invoice.customerNit}${clTec}${tipoAmb}`;
    
    return crypto.createHash('sha384').update(rawData).digest('hex');
  }

  // --- LÓGICA DE ENVÍO SOAP ---
  async sendToDian(xmlPath: string, fileName: string, testSetId: string) {
    const zip = new AdmZip();
    zip.addLocalFile(xmlPath);
    const zipBuffer = zip.toBuffer();
    const base64Zip = zipBuffer.toString('base64');

    const soapEnvelope = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wcf="http://wcf.dian.colombia">
        <soap:Header/>
        <soap:Body>
          <wcf:SendTestSetAsync>
            <wcf:fileName>${fileName}.zip</wcf:fileName>
            <wcf:contentFile>${base64Zip}</wcf:contentFile>
            <wcf:testSetId>${testSetId}</wcf:testSetId>
          </wcf:SendTestSetAsync>
        </soap:Body>
      </soap:Envelope>
    `;

    try {
      const response = await axios.post(
        'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc',
        soapEnvelope,
        {
          headers: {
            'Content-Type': 'application/soap+xml;charset=UTF-8',
            'SOAPAction': 'http://wcf.dian.colombia/IDianCustomerServices/SendTestSetAsync'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Error SOAP:', error.response?.data || error.message);
      throw error;
    }
  }
}