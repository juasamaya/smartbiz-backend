import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const companyId = request.user.companyId;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) return false;

    // LÍMITES POR PLAN
    const limits = {
      'FREE': 5,
      'STARTER': 30,
      'PRO': 9999999
    };

    const now = new Date();
    const cycleStart = new Date(company.currentCycleStart);
    const oneMonthLater = new Date(cycleStart);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    if (now >= oneMonthLater) {
      // Reiniciamos ciclo
      await this.prisma.company.update({
        where: { id: companyId },
        data: { 
          currentCycleStart: now,
          invoiceCount: 0 
        }
      });
      return true; // Nuevo mes, tiene cupo libre
    }

    // Verificar límite
    const limit = limits[company.planType] || 5;
    
    if (company.invoiceCount >= limit) {
      throw new ForbiddenException(
        `Has alcanzado el límite de tu plan ${company.planType} (${limit} facturas). Actualiza a PRO para continuar.`
      );
    }

    return true;
  }
}