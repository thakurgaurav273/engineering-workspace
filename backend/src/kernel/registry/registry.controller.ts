import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RegistryService } from './registry.service';

/**
 * Read-only application catalog for the shell (T051 surface). Auth-guarded like the rest
 * of the API; returns the enabled apps + their nav metadata so the frontend can render
 * registry-driven navigation. Additive — no existing endpoint changes.
 */
@UseGuards(JwtAuthGuard)
@Controller('platform/applications')
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}

  @Get()
  list() {
    return this.registry.listEnabled();
  }
}
