import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ClsService } from 'nestjs-cls';
import { loadConfig } from './config/env';
import { AllExceptionsFilter, ResponseInterceptor } from './common/http';
import type { RequestStore } from './common/context';

/** Applies security middleware, validation, envelope and Swagger. Shared by main.ts and e2e tests. */
export function configureApp(app: INestApplication) {
  const cfg = loadConfig();
  app.setGlobalPrefix('api/v1');
  const express = app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void; disable: (k: string) => void };
  express.set('trust proxy', 1);
  express.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: cfg.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Correlation-Id'],
    exposedHeaders: ['X-Correlation-Id', 'Content-Disposition'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(app.get(ClsService<RequestStore>)));

  const doc = new DocumentBuilder()
    .setTitle('Pharmodry API')
    .setDescription('Pharmaceutical Operations, Quality & Compliance Intelligence Platform — REST API v1. Responses use the envelope { data, meta } / { error }.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc), { jsonDocumentUrl: 'api/docs-json' });
  return app;
}
