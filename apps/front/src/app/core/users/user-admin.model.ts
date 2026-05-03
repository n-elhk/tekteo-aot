import type { Role } from '@org/types';

export type { Role };
export type { UpdateUserDto } from '@org/schemas';

/** Utilisateur admin (vue complète depuis `/users`). */
export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly name: string | null;
  readonly role: Role;
  readonly createdAt: string;
  readonly updatedAt: string;
}
