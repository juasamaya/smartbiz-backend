import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@Req() req: any) {
    return this.dashboardService.getStats(req.user.companyId);
  }

  @Get('charts')
  getCharts(@Req() req) {
    return this.dashboardService.getChartData(req.user.companyId);
  }
}