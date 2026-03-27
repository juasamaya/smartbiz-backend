import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'SecretKeyPorDefectoParaDev', 
    });
  }

  async validate(payload: any) {
    // Retornamos 'id' en lugar de 'userId' para estandarizarlo en todo el backend
    return { 
      id: payload.sub, 
      email: payload.email, 
      companyId: payload.companyId 
    };
  }
}