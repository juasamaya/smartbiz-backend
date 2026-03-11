import { 
  Injectable, 
  BadRequestException, 
  NotFoundException, 
  InternalServerErrorException 
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  
  private readonly PRICES = {
    'STARTER': 19900, 
    'PRO': 59900      
  };

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService
  ) {}

  async generateSignature(userId: string, planId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });

    if (!user || !user.company) throw new NotFoundException('Empresa no encontrada');

    const price = this.PRICES[planId];
    if (!price) throw new BadRequestException('Plan inválido');

    const amountInCents = price * 100; 
    
    const reference = `${user.company.id}-${Date.now()}`;
    const currency = 'COP';
    const integritySecret = process.env.WOMPI_INTEGRITY; 
    
    const rawSignature = `${reference}${amountInCents}${currency}${integritySecret}`;
    const signature = crypto.createHash('sha256').update(rawSignature).digest('hex');

    return {
      reference,
      amountInCents,
      currency,
      publicKey: process.env.WOMPI_PUB_KEY,
      signature
    };
  }

  async verifyAndUpgrade(userId: string, transactionId: string) {
    try {
      const url = `https://production.wompi.co/v1/transactions/${transactionId}`;
      const { data } = await lastValueFrom(this.httpService.get(url));
      
      const status = data.data.status;
      const reference = data.data.reference; 
      const amountPaid = data.data.amount_in_cents / 100; 

      if (status !== 'APPROVED') {
        throw new BadRequestException('Pago no aprobado');
      }

      const companyId = reference.split('-')[0];
      let newPlan = 'FREE';

      if (amountPaid === this.PRICES.STARTER) newPlan = 'STARTER';
      if (amountPaid === this.PRICES.PRO) newPlan = 'PRO';

      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          planType: newPlan,
          planStatus: 'ACTIVE',
          currentCycleStart: new Date()
        }
      });

      return { success: true, plan: newPlan };

    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Error verificando pago');
    }
  }
}