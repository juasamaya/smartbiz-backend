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
    // CORREGIDO: req.user.id
    return this.invoicesService.create(req.user.id, createInvoiceDto);
  }

  @Get()
  findAll(@Request() req, @Query() paginationDto: PaginationDto) {
    // CORREGIDO: req.user.id
    return this.invoicesService.findAll(req.user.id, paginationDto);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    // CORREGIDO: req.user.id
    return this.invoicesService.findOne(id, req.user.id);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @Request() req, 
    @Param('id') id: string, 
    @Res() res: Response
  ) {
    // CORREGIDO: req.user.id
    const pdfBuffer = await this.invoicesService.generatePdf(id, req.user.id);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}