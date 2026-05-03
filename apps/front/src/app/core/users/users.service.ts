import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { UpdateUserDto } from '@org/schemas';
import { AdminUser } from './user-admin.model';

const API = '/api/users';

/**
 * Client HTTP pour les utilisateurs.
 * Toutes les routes (sauf `/me`) sont admin uniquement côté API.
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(API);
  }

  get(id: string): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${API}/${id}`);
  }

  update(id: string, dto: UpdateUserDto): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${API}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/${id}`);
  }
}
