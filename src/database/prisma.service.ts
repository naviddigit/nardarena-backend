import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Service - Database connection and query management
 * Implements SOLID principles:
 * - Single Responsibility: Only handles database connections
 * - Dependency Inversion: Components depend on this abstraction
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      this.$on('query' as never, (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    this.$on('error' as never, (e: any) => {
      this.logger.error(`Database error: ${e.message}`);
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Database disconnected');
  }

  /**
   * Clean database for testing (use with caution!)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this).filter((key) => {
      const keyStr = String(key);
      return keyStr[0] !== '_';
    });

    return Promise.all(
      models.map((modelKey) => {
        const model = (this as any)[modelKey];
        return model?.deleteMany ? model.deleteMany() : Promise.resolve();
      }),
    );
  }
}
