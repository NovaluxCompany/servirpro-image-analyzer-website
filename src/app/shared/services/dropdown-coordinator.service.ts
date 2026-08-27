import { Injectable, signal } from '@angular/core';

/**
 * Coordina qué instancia de un dropdown (searchable-select, etc.) puede estar
 * abierta a la vez. Sin esto, cada instancia mantiene su propio estado local y
 * abrir un segundo select no cierra el primero.
 */
@Injectable({ providedIn: 'root' })
export class DropdownCoordinatorService {
  private _activeId = signal<number | null>(null);
  activeId = this._activeId.asReadonly();

  private nextId = 0;

  register(): number {
    this.nextId += 1;
    return this.nextId;
  }

  setActive(id: number): void {
    this._activeId.set(id);
  }

  clear(id: number): void {
    if (this._activeId() === id) {
      this._activeId.set(null);
    }
  }
}
