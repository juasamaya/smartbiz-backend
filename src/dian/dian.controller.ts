import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { DianService } from './dian.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetAcquirerDto } from './dto/get-acquirer.dto';

@Controller('dian')
export class DianController {
  constructor(private readonly dianService: DianService) {}

  @UseGuards(JwtAuthGuard)
  @Post('get-acquirer')
  async getAcquirer(@Request() req, @Body() getAcquirerDto: GetAcquirerDto) {
    // El user.companyId viene del token JWT
    return this.dianService.getAcquirer(
        req.user.companyId, 
        getAcquirerDto.identificationType, 
        getAcquirerDto.identificationNumber
    );
  }
}