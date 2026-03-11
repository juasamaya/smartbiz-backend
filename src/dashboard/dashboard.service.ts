import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(companyId: string) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Total Facturado (Mes actual)
    const monthSales = await this.prisma.invoice.aggregate({
      where: {
        companyId,
        date: { gte: firstDayOfMonth },
      },
      _sum: { total: true, tax: true, subtotal: true },
      _count: { id: true }
    });

    // 2. Estado de la DIAN (Gráfico circular)
    const statusGroups = await this.prisma.invoice.groupBy({
      by: ['dianStatus'],
      where: { companyId },
      _count: { id: true }
    });

    // 3. Últimas 5 facturas
    const recentInvoices = await this.prisma.invoice.findMany({
      where: { companyId },
      orderBy: { date: 'desc' },
      take: 5,
    });

    return {
      totalSales: monthSales._sum.total || 0,
      totalTax: monthSales._sum.tax || 0,
      invoiceCount: monthSales._count.id || 0,
      statusStats: statusGroups,
      recentInvoices
    };
  }

  async getChartData(companyId: string) {
    // 1. Calcular fecha de hace 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // 2. Traer facturas de los últimos 6 meses
    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        date: { gte: sixMonthsAgo }, // gte = Mayor o igual que
      },
      orderBy: { date: 'asc' }
    });

    // 3. Agrupar por Mes (Ene, Feb, Mar...)
    const monthlySales: Record<string, number> = {};
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    invoices.forEach(inv => {
      const monthIndex = new Date(inv.date).getMonth();
      const monthName = months[monthIndex];
      // Sumamos el total de esa factura al mes correspondiente
      monthlySales[monthName] = (monthlySales[monthName] || 0) + Number(inv.total);
    });

    // 4. Convertir a formato para el Gráfico
    // Ejemplo: [{ name: 'Ene', ventas: 150000 }, { name: 'Feb', ventas: 200000 }]
    const chartData = Object.keys(monthlySales).map(key => ({
      name: key,
      ventas: monthlySales[key]
    }));

    // 5. Calcular productos más vendidos (Top 5)
    // Esto requiere traer los items, por ahora haremos un mock o conteo simple
    // Para no complicar la query, devolveremos solo el historial de ventas por ahora.
    
    return { salesHistory: chartData };
  }
}