import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private prisma: PrismaService) {
    const apiKey = process.env.GEMINI_API_KEY;

    // Inicializamos Gemini
    this.genAI = new GoogleGenerativeAI(apiKey || '');
    
    // Usamos el modelo estándar. 
    // Si 'gemini-1.5-flash' te da 404, cambia esta línea por 'gemini-pro'
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
  }

  async chat(companyId: string, userMessage: string) {
    // 1. Recopilar Contexto del Negocio
    const stats = await this.prisma.invoice.aggregate({
      where: { companyId },
      _sum: { total: true, tax: true },
      _count: { id: true }
    });

    const recentInvoices = await this.prisma.invoice.findMany({
      where: { companyId },
      orderBy: { date: 'desc' },
      take: 5,
      select: { number: true, customerName: true, total: true, date: true }
    });

    // 2. Construir el Prompt del Sistema
    const context = `
      Eres 'SmartBiz AI', un experto financiero y contable asistente de esta empresa.
      
      DATOS EN TIEMPO REAL DE LA EMPRESA:
      - Total Vendido Histórico: $${stats._sum.total || 0}
      - Total IVA Recaudado: $${stats._sum.tax || 0}
      - Cantidad de Facturas: ${stats._count.id || 0}
      - Últimas 5 facturas: ${JSON.stringify(recentInvoices)}
      
      INSTRUCCIONES:
      - Responde de forma breve, profesional y útil.
      - Si te preguntan por ventas, usa los datos de arriba.
    `;

    // 3. Preguntar a Gemini
    try {
      const chat = this.model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: context }],
          },
          {
            role: 'model',
            parts: [{ text: 'Entendido. Soy SmartBiz AI, listo para ayudar.' }],
          },
        ],
      });

      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      return { text: response.text() };
      
    } catch (error) {
      console.error("Error consultando a Gemini:", error);
      return { text: "Lo siento, tuve un problema conectando con mi cerebro de IA. Intenta de nuevo." };
    }
  }
}