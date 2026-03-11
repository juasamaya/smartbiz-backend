import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller'; // El que te di antes
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyController],
})
export class CompanyModule {}