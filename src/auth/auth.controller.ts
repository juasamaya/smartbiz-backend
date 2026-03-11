import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() req) {
    const validUser = await this.authService.validateUser(req.email, req.password);
    if (!validUser) return { message: 'Invalid credentials' };
    return this.authService.login(validUser);
  }

  @Post('register')
  async register(@Body() body) {
    return this.authService.register(body);
  }
}