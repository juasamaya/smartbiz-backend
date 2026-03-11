import { 
  Controller, 
  Put, 
  Body, 
  UseGuards, 
  Req, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from 'prisma/prisma.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import * as path from 'path';

@Controller('company')
export class CompanyController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Put('settings')
  @UseInterceptors(FileInterceptor('certificate', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        // Usamos ruta absoluta para evitar problemas en Windows
        const uploadPath = path.join(process.cwd(), 'certificates');
        if (!fs.existsSync(uploadPath)) {
          console.log('📁 Creando carpeta certificates...');
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = extname(file.originalname);
        cb(null, `cert-${uniqueSuffix}${ext}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      console.log(`📂 [Filtro] Recibiendo archivo: ${file.originalname}`);
      if (!file.originalname.match(/\.(p12|pfx)$/)) {
        return cb(new BadRequestException('Solo se permiten archivos .p12 o .pfx'), false);
      }
      cb(null, true);
    },
  }))
  async updateSettings(
    @Req() req: any, 
    @UploadedFile() file: Express.Multer.File, 
    @Body() body: { password?: string }
  ) {
    console.log('🚀 [Controlador] Iniciando updateSettings');
    
    // DEBUG: Ver qué trae el usuario exactamente
    console.log('👤 Usuario RAW:', req.user);

    // 1. Detectar ID de usuario (A prueba de balas)
    const userId = req.user?.id || req.user?.userId || req.user?.sub;

    if (!userId) {
        console.error('❌ ERROR FATAL: El token no tiene ID de usuario.');
        throw new BadRequestException('Error de autenticación: Token inválido');
    }
    console.log(`✅ ID detectado: ${userId}`);

    // 2. Buscar usuario en BD
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new BadRequestException('Usuario no existe en BD');
    if (!user.companyId) {
        console.error('❌ El usuario no tiene empresa asignada.');
        throw new BadRequestException('Usuario sin empresa');
    }

    console.log(`🏢 Actualizando empresa ID: ${user.companyId}`);

    // 3. Preparar datos
    const updateData: any = {};
    
    if (body.password) {
        updateData.certificatePass = body.password;
        console.log('🔑 Contraseña recibida');
    }

    if (file) {
        // IMPORTANTE: Guardamos la ruta absoluta o relativa, Prisma prefiere string simple
        updateData.certificatePath = file.path;
        console.log(`💾 Ruta archivo: ${file.path}`);
    } else {
        console.warn('⚠️ OJO: No llegó el objeto "file" al controlador. ¿Multer falló?');
    }

    // 4. Actualizar BD
    try {
        const result = await this.prisma.company.update({
            where: { id: user.companyId },
            data: updateData,
        });
        console.log('🎉 ¡ÉXITO! Base de datos actualizada.');
        return result;
    } catch (error) {
        console.error('❌ Error Prisma:', error);
        throw error;
    }
  }
}