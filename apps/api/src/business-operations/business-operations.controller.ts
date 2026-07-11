import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RegistryService } from '../kernel/registry/registry.service';

/**
 * Minimal Business Operations endpoints - they exist only to prove the application is
 * wired and registered. No business logic. Real controllers (clients, invoices, …) arrive
 * with the migration phase.
 */
@UseGuards(JwtAuthGuard)
@Controller('business')
export class BusinessOperationsController {
  constructor(private readonly registry: RegistryService) {}

  @Get('health')
  health() {
    return { status: 'ok', application: 'business-operations' };
  }

  @Get('info')
  info() {
    const manifest = this.registry.get('business-operations');
    return {
      registered: !!manifest,
      key: manifest?.key,
      name: manifest?.name,
      version: manifest?.version,
      routePrefix: manifest?.routePrefix,
      status: manifest?.status,
      navItems: manifest?.navigation.length ?? 0,
    };
  }
}
