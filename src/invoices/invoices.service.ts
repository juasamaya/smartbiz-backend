import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException, 
  InternalServerErrorException
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PaginationDto } from '../common/dtos/pagination.dto';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  private async getCompanyFromUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });
    
    if (!user || !user.company) {
      throw new NotFoundException('El usuario no pertenece a ninguna compañía');
    }
    return user.company;
  }

  async create(userId: string, createInvoiceDto: CreateInvoiceDto) {
    try {
      const company = await this.getCompanyFromUser(userId);

      const count = await this.prisma.invoice.count({
        where: { companyId: company.id }
      });
      
      const planLimits: Record<string, number> = {
        'FREE': 5,
        'STARTER': 30,
        'PRO': 9999999
      };

      const limit = planLimits[company.planType || 'FREE'] || 5;
      
      if (count >= limit) {
        throw new ForbiddenException('Límite de facturas alcanzado');
      }

      const subtotal = createInvoiceDto.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const tax = subtotal * 0.19;
      const total = subtotal + tax;

      const invoice = await this.prisma.invoice.create({
        data: {
          customerName: createInvoiceDto.customerName,
          customerNit: createInvoiceDto.customerNit,
          customerEmail: createInvoiceDto.customerEmail,
          subtotal: subtotal,
          tax: tax,
          total: total,
          company: { connect: { id: company.id } },
          items: {
            create: createInvoiceDto.items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice
            }))
          }
        },
        include: { items: true }
      });

      return invoice;

    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error creando la factura');
    }
  }

  async findAll(userId: string, paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    try {
      const company = await this.getCompanyFromUser(userId);

      const [total, items] = await this.prisma.$transaction([
        this.prisma.invoice.count({ where: { companyId: company.id } }),
        this.prisma.invoice.findMany({
          where: { companyId: company.id },
          orderBy: { date: 'desc' },
          skip,
          take,
          include: { items: true }
        })
      ]);

      return {
        items,
        meta: {
          totalItems: total,
          itemCount: items.length,
          itemsPerPage: take,
          totalPages: Math.ceil(total / take),
          currentPage: Number(page),
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Error obteniendo facturas');
    }
  }

  async findOne(id: string, userId: string) {
    const company = await this.getCompanyFromUser(userId);

    const invoice = await this.prisma.invoice.findFirst({
      where: { 
        id, 
        companyId: company.id
      },
      include: { items: true }
    });

    if (!invoice) throw new NotFoundException('Factura no encontrada');
    return invoice;
  }

  async generatePdf(id: string, userId: string): Promise<Buffer> {
    const invoice = await this.findOne(id, userId);
    return Buffer.from(`Factura ${invoice.prefix}${invoice.number}`);
  }
}