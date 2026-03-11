import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PdfService } from './pdf.service';
import { PrismaModule } from 'prisma/prisma.module';
import { DianModule } from '../dian/dian.module';
import { MailModule } from '../mail/mail.module'

@Module({
  imports: [
    PrismaModule, 
    DianModule,
    MailModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, PdfService],
})
export class InvoicesModule { }