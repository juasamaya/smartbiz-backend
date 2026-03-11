import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('wompi-params/:planId')
  getWompiParams(@Request() req, @Param('planId') planId: string) {
    return this.paymentsService.generateSignature(req.user.userId, planId);
  }

  @Post('confirm')
  confirmPayment(@Request() req, @Body() body: { transactionId: string }) {
    return this.paymentsService.verifyAndUpgrade(req.user.userId, body.transactionId);
  }
}