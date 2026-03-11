import { Controller, Post, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from 'prisma/prisma.service';
import { PLANS } from '../utils/plans';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService 
  ) {}

  @Post('ask')
  async ask(@Request() req, @Body() body: { message: string }) {
    const companyId = req.user.companyId;

    // 1. Buscamos la empresa
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    
    if (!company) {
        throw new ForbiddenException('Empresa no encontrada.');
    }

    // 2. Verificamos el plan
    // Usamos 'FREE' si el campo viene vacío o null
    const planName = company.plan || 'FREE';
    const currentPlan = PLANS[planName];

    if (!currentPlan || !currentPlan.hasAi) {
      throw new ForbiddenException('Tu plan actual no incluye acceso a la Inteligencia Artificial. Actualiza a PRO.');
    }

    // 3. Si pasa, usamos el servicio
    return this.aiService.chat(companyId, body.message);
  }
}