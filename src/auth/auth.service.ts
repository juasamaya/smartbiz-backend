import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.email, sub: user.id };
    
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { company: true }
    });

    if (!fullUser || !fullUser.company) {
      throw new InternalServerErrorException('Error recuperando datos del usuario');
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: fullUser.id,
        email: fullUser.email,
        name: fullUser.name,
        company: {
          id: fullUser.company.id,
          businessName: fullUser.company.businessName,
          plan: fullUser.company.plan
        }
      }
    };
  }

  async register(registerDto: RegisterDto) {
    const { name, email, password, businessName, nit } = registerDto;

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new BadRequestException('El correo ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        company: {
          create: {
            businessName,
            nit,
            plan: 'FREE' 
          }
        }
      }
    });
  }
}