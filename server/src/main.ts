import 'reflect-metadata';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api');

  // Serve the operator dashboard (static) from ./public — e.g. /admin.html.
  app.useStaticAssets(join(process.cwd(), 'public'));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  const log = new Logger('Bootstrap');
  log.log(`BusMapp API listening on http://0.0.0.0:${port}/api`);
  log.log(`Operator dashboard at http://0.0.0.0:${port}/admin.html`);
}

void bootstrap();
