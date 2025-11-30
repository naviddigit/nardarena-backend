import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Get configuration
  const port = configService.get<number>('PORT', 3001);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:8083');

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // CORS configuration
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Global prefix for all routes
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Nard Arena API')
    .setDescription('Professional Backgammon Gaming Platform API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('games', 'Game management endpoints')
    .addTag('admin', 'Admin panel endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  await app.listen(port);

  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   🎲 Nard Arena Backend API                          ║
  ║                                                       ║
  ║   🚀 Server running on: http://localhost:${port}      ║
  ║   📚 API Documentation: http://localhost:${port}/${apiPrefix}/docs  ║
  ║   🌍 Environment: ${configService.get('NODE_ENV', 'development')}            ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
  `);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
