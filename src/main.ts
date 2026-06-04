import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Set global API prefix
  app.setGlobalPrefix('api');

  // Enable CORS for frontend requests
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enforce validation rules globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Start the NestJS application listening on the configured port.
  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Bombo Twerk Backend running on: http://localhost:${port}/api`);
}
bootstrap();
