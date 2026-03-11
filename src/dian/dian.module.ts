import { Module } from '@nestjs/common';
import { DianService } from './dian.service';
import { DianController } from './dian.controller';
import { PrismaModule } from './../../prisma/prisma.module';
import { SignerService } from './signer.service';

@Module({
  imports: [PrismaModule],
  controllers: [DianController],
  providers: [DianService, SignerService],
  exports: [DianService],
})
export class DianModule {}