import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RolesService } from '../../services/roles.service';
import { MenusService } from '../../../menu/services/menus.service';
import { Role } from '../../interfaces/role.interface';
import { Menu } from '../../../menu/interfaces/menu.interface';
import { ToastService } from '../../../../core/service/toast.service';
import { PermissionService } from '../../../../core/service/permission.service';

export interface MenuGroup {
  menu: Menu;
  children: Menu[];
}

@Component({
  selector: 'app-assign-permissions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assign-permissions.component.html',
})
export class AssignPermissionsComponent implements OnInit {
  private rolesService = inject(RolesService);
  private menusService = inject(MenusService);
  private toastService = inject(ToastService);
  private permissionService = inject(PermissionService);

  canEditPermissions = computed(() => this.permissionService.can('edit', '/roles/asignar-permisos'));

  roles = signal<Role[]>([]);
  menus = signal<Menu[]>([]);
  selectedRoleId = signal<number | null>(null);
  isLoading = signal(false);
  isPermissionError = signal(false);
  isSaving = signal(false);
  showConfirm = signal(false);

  /** Set original (tal como está guardado) y set en edición (checkboxes actuales) */
  originalMenuPermissionIds = signal(new Set<number>());
  selectedMenuPermissionIds = signal(new Set<number>());

  selectedRole = computed(() => this.roles().find((r) => r.id === this.selectedRoleId()) ?? null);

  generalMenus = computed(() => this.groupByParent(this.menus().filter((m) => !m.isSensitive)));
  sensitiveMenus = computed(() => this.groupByParent(this.menus().filter((m) => m.isSensitive)));

  hasChanges = computed(() => {
    const current = this.selectedMenuPermissionIds();
    const original = this.originalMenuPermissionIds();
    if (current.size !== original.size) return true;
    for (const id of current) {
      if (!original.has(id)) return true;
    }
    return false;
  });

  /**
   * Resuelve el menú padre de otro. Usa parentId si está disponible en la BD;
   * si no (los seeds actuales lo traen en null), infiere el padre por el path
   * (ej. /roles/asignar-permisos -> /roles).
   */
  private getParentMenu(menu: Menu, allMenus: Menu[] = this.menus()): Menu | undefined {
    if (menu.parentId) {
      const byId = allMenus.find((m) => m.id === menu.parentId);
      if (byId) return byId;
    }
    const segments = (menu.path ?? '').split('/').filter(Boolean);
    if (segments.length <= 1) return undefined;
    const parentPath = `/${segments.slice(0, -1).join('/')}`;
    return allMenus.find((m) => m.path === parentPath);
  }

  private groupByParent(menus: Menu[]): MenuGroup[] {
    const roots = menus.filter((m) => this.getParentMenu(m, menus) == null);
    return roots.map((menu) => ({
      menu,
      children: menus.filter((m) => this.getParentMenu(m, menus)?.id === menu.id),
    }));
  }

  /** Si el menú es hijo de otro, solo puede asignarse permisos si el padre ya tiene alguno marcado. */
  isMenuLocked(menu: Menu): boolean {
    const parent = this.getParentMenu(menu);
    if (!parent) return false;
    const parentIds = (parent.menuPermissions ?? []).map((mp) => mp.id!);
    const current = this.selectedMenuPermissionIds();
    return !parentIds.some((id) => current.has(id));
  }

  private summaryFor(groups: MenuGroup[]): { menuName: string; permissions: string[] }[] {
    const current = this.selectedMenuPermissionIds();
    const flatMenus = groups.flatMap((g) => [g.menu, ...g.children]);
    return flatMenus
      .map((menu) => ({
        menuName: menu.name,
        permissions: (menu.menuPermissions ?? [])
          .filter((mp) => current.has(mp.id!))
          .map((mp) => mp.permission.description),
      }))
      .filter((entry) => entry.permissions.length > 0);
  }

  generalSelectionSummary = computed(() => this.summaryFor(this.generalMenus()));
  sensitiveSelectionSummary = computed(() => this.summaryFor(this.sensitiveMenus()));

  ngOnInit() {
    this.loadRoles();
    this.loadMenus();
  }

  loadRoles() {
    this.isLoading.set(true);
    this.isPermissionError.set(false);
    this.rolesService.findAll(1, 100).subscribe({
      next: (res) => {
        this.roles.set(res.items);
        this.isLoading.set(false);
      },
      error: (error: { status?: number }) => {
        if (error?.status === 403) {
          this.isPermissionError.set(true);
        } else {
          this.toastService.showError('Error al cargar los roles.');
        }
        this.isLoading.set(false);
      },
    });
  }

  loadMenus() {
    this.menusService.findAll(1, 100).subscribe({
      next: (res) => this.menus.set(res.items.filter((m) => m.isActive && m.path !== '/menu')),
      error: (error: { status?: number }) => {
        if (error?.status === 403) {
          this.isPermissionError.set(true);
        } else {
          this.toastService.showError('Error al cargar los menús.');
        }
      },
    });
  }

  onRoleChange(roleId: string) {
    const id = roleId ? Number(roleId) : null;
    this.selectedRoleId.set(id);
    const role = this.selectedRole();
    const grantedIds = (role?.roleMenuPermissions ?? []).map((rmp) => rmp.menuPermissionId);
    this.originalMenuPermissionIds.set(new Set(grantedIds));
    this.selectedMenuPermissionIds.set(new Set(grantedIds));
  }

  isChecked(menuPermissionId: number): boolean {
    return this.selectedMenuPermissionIds().has(menuPermissionId);
  }

  private findMenuByPermissionId(menuPermissionId: number): Menu | undefined {
    return this.menus().find((m) => (m.menuPermissions ?? []).some((mp) => mp.id === menuPermissionId));
  }

  private cascadeUncheckChildren(menu: Menu, ids: Set<number>) {
    const children = this.menus().filter((m) => this.getParentMenu(m)?.id === menu.id);
    for (const child of children) {
      for (const mp of child.menuPermissions ?? []) {
        ids.delete(mp.id!);
      }
      this.cascadeUncheckChildren(child, ids);
    }
  }

  toggle(menuPermissionId: number, checked: boolean) {
    const menu = this.findMenuByPermissionId(menuPermissionId);

    if (checked && menu && this.isMenuLocked(menu)) {
      const parent = this.getParentMenu(menu);
      this.toastService.showError(`Primero debes asignar permisos en "${parent?.name}".`);
      return;
    }

    const next = new Set(this.selectedMenuPermissionIds());
    if (checked) {
      next.add(menuPermissionId);
    } else {
      next.delete(menuPermissionId);
    }

    if (!checked && menu && this.isMenuLockedFor(menu, next)) {
      this.cascadeUncheckChildren(menu, next);
    }

    this.selectedMenuPermissionIds.set(next);
  }

  private isMenuLockedFor(menu: Menu, ids: Set<number>): boolean {
    const ownIds = (menu.menuPermissions ?? []).map((mp) => mp.id!);
    return !ownIds.some((id) => ids.has(id));
  }

  isMenuFullyChecked(menu: Menu): boolean {
    const ids = menu.menuPermissions ?? [];
    if (!ids.length) return false;
    const current = this.selectedMenuPermissionIds();
    return ids.every((mp) => current.has(mp.id!));
  }

  isMenuPartiallyChecked(menu: Menu): boolean {
    const ids = menu.menuPermissions ?? [];
    const current = this.selectedMenuPermissionIds();
    const checkedCount = ids.filter((mp) => current.has(mp.id!)).length;
    return checkedCount > 0 && checkedCount < ids.length;
  }

  toggleMenu(menu: Menu, checked: boolean) {
    if (checked && this.isMenuLocked(menu)) {
      const parent = this.getParentMenu(menu);
      this.toastService.showError(`Primero debes asignar permisos en "${parent?.name}".`);
      return;
    }

    const next = new Set(this.selectedMenuPermissionIds());
    for (const mp of menu.menuPermissions ?? []) {
      if (checked) {
        next.add(mp.id!);
      } else {
        next.delete(mp.id!);
      }
    }

    if (!checked) {
      this.cascadeUncheckChildren(menu, next);
    }

    this.selectedMenuPermissionIds.set(next);
  }

  askConfirm() {
    if (!this.canEditPermissions()) {
      this.toastService.showError('Tu rol no tiene permiso para asignar permisos.');
      return;
    }
    this.showConfirm.set(true);
  }

  cancelConfirm() {
    this.showConfirm.set(false);
  }

  confirmChange() {
    const role = this.selectedRole();
    if (!role?.id) return;

    this.isSaving.set(true);
    const menuPermissionIds = Array.from(this.selectedMenuPermissionIds());

    this.rolesService.update(role.id, { menuPermissionIds }).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.showConfirm.set(false);
        this.originalMenuPermissionIds.set(new Set(menuPermissionIds));
        this.roles.set(this.roles().map((r) => (r.id === updated.id ? updated : r)));
        this.toastService.showSuccess('Permisos actualizados correctamente.');
      },
      error: () => {
        this.isSaving.set(false);
        this.showConfirm.set(false);
        this.toastService.showError('No se pudieron actualizar los permisos. Intenta de nuevo.');
      },
    });
  }
}
