import type { AuthUser, Role } from '@org/types';
import type { LoginDto, RegisterDto } from '@org/schemas';

/** Utilisateur authentifié — réexporté depuis les types partagés. */
export type User = AuthUser;
export type UserRole = Role;

/** Identifiants de connexion (alias du DTO partagé). */
export type LoginCredentials = LoginDto;
export type RegisterCredentials = RegisterDto;
