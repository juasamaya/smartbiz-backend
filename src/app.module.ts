import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './../prisma/prisma.module';
import { DianModule } from './dian/dian.module';
import { CompanyModule } from './company/company.module';
import { InvoicesModule } from './invoices/invoices.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PaymentsModule } from './payments/payments.module';
import { AiModule } from './ai/ai.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    DianModule,
    CompanyModule,
    InvoicesModule,
    DashboardModule,
    PaymentsModule,
    AiModule,
    MailModule,
  ],
})
export class AppModule {}