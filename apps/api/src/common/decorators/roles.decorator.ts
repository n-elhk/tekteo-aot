import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/client';

export const Roles = Reflector.createDecorator<Role[]>();
