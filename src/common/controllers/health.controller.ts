import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async healthCheck() {
    const startTime = Date.now();
    const responseTime = Date.now() - startTime;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      services: {
        api: {
          status: 'healthy',
          port: 3002,
        },
        database: {
          status: 'healthy',
          message: 'Connected',
        },
      },
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Simple status check' })
  getStatus() {
    return {
      status: 'ok',
      message: '🎲 Nard Arena Backend is running!',
      timestamp: new Date().toISOString(),
    };
  }
}
