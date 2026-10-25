import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadConfig } from './config/env';
import { JsonLogger } from './common/logger';

async function bootstrap() {
  const cfg = loadConfig();
  const app = await NestFactory.create(AppModule, { logger: cfg.nodeEnv === 'production' ? new JsonLogger() : ['log', 'warn', 'error'] });
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(cfg.port);
  Logger.log(`Pharmodry API listening on http://localhost:${cfg.port}/api/v1 (docs: /api/docs)`, 'Bootstrap');
}

void bootstrap();
