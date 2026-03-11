import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  Request, 
  Query, 
  Res 
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PaginationDto } from '../common/dtos/pagination.dto';
import type { Response } from 'express'; 

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  create(@Request() req, @Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(req.user.userId, createInvoiceDto);
  }

  @Get()
  findAll(@Request() req, @Query() paginationDto: PaginationDto) {
    return this.invoicesService.findAll(req.user.userId, paginationDto);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.invoicesService.findOne(id, req.user.userId);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @Request() req, 
    @Param('id') id: string, 
    @Res() res: Response
  ) {
    const pdfBuffer = await this.invoicesService.generatePdf(id, req.user.userId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}