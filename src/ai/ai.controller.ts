import { Controller, Post, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from 'prisma/prisma.service'; // Asegúrate de que esta ruta sea la correcta en tu proyecto
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
    // 1. Obtenemos el ID del usuario desde el token de forma segura
    const userId = req.user.id || req.user.sub;

    // 2. Buscamos al usuario en la base de datos e incluimos la información de su empresa
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true } // Esto es vital para traer los datos de la empresa
    });
    
    // Extraemos la empresa del usuario encontrado
    const company = user?.company;

    if (!company) {
        throw new ForbiddenException('Empresa no encontrada o el usuario no tiene una empresa asociada.');
    }

    // 3. Verificamos el plan
    // Usamos 'FREE' si el campo viene vacío o null
    const planName = company.plan || 'FREE';
    const currentPlan = PLANS[planName];

    if (!currentPlan || !currentPlan.hasAi) {
      throw new ForbiddenException('Tu plan actual no incluye acceso a la Inteligencia Artificial. Actualiza a PRO.');
    }

    // 4. Si pasa, usamos el servicio pasando el ID real de la base de datos
    return this.aiService.chat(company.id, body.message);
  }
}