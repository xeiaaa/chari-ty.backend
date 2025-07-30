import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Configure CORS
  // const clientUrl = configService.get<string>(
  //   'FRONTEND_URL',
  //   'http://localhost:3001',
  // );
  app.enableCors({
    origin: (_origin, callback) => {
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  });

  // Set global API prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Chari-ty API')
    .setDescription('The Chari-ty API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('groups', 'Group management endpoints')
    .addTag('fundraisers', 'Fundraiser management endpoints')
    .addTag('donations', 'Donation management endpoints')
    .addTag('milestones', 'Milestone management endpoints')
    .addTag('payments', 'Payment processing endpoints')
    .addTag('uploads', 'File upload endpoints')
    .addTag('links', 'Link management endpoints')
    .addTag('webhooks', 'Webhook endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  console.log(
    `Swagger documentation available at: http://localhost:${port}/docs`,
  );
}
bootstrap();
