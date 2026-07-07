import { Injectable, RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/guards/roles.guard';
import { PERMISSION_KEY, PermissionRequirement } from './require-permission.decorator';

export interface EndpointInfo {
  method: string;
  route: string;
  controller: string;
  handler: string;
  roles: string[];
  permissions: string[];
  application: string;
}

function joinPath(...parts: (string | undefined)[]): string {
  const path = parts
    .filter((p): p is string => !!p && p !== '/')
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return '/' + path;
}

/** Scans every controller for its route metadata + @Roles / @RequirePermission declarations. */
@Injectable()
export class PermissionMetadataDiscovery {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  discoverEndpoints(): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const instance = wrapper.instance;
      const metatype = wrapper.metatype as (new (...args: unknown[]) => unknown) | undefined;
      if (!instance || !metatype) continue;

      const controllerPath = Reflect.getMetadata(PATH_METADATA, metatype) as string | undefined;
      const prototype = Object.getPrototypeOf(instance);

      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const handler = prototype[name];
        const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler);
        if (httpMethod === undefined) continue; // not a route handler

        const roles = this.reflector.get<string[]>(ROLES_KEY, handler) ?? [];
        const requirement = this.reflector.get<PermissionRequirement>(PERMISSION_KEY, handler);
        const permissions = requirement?.permissions ?? [];
        const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;

        endpoints.push({
          method: RequestMethod[httpMethod] ?? String(httpMethod),
          route: joinPath(controllerPath, methodPath),
          controller: metatype.name,
          handler: name,
          roles,
          permissions,
          application: permissions[0]?.split(':')[0] ?? (controllerPath?.split('/').filter(Boolean)[0] ?? 'unknown'),
        });
      }
    }
    return endpoints.sort((a, b) => a.route.localeCompare(b.route));
  }

  /** Endpoints that declare @Roles but no @RequirePermission — the migration gap. */
  endpointsMissingPermissions(): EndpointInfo[] {
    return this.discoverEndpoints().filter((e) => e.roles.length > 0 && e.permissions.length === 0);
  }
}
