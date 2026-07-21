import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RolesService } from '../../services/roles.service';
import { MenusService } from '../../../menu/services/menus.service';
import { Role } from '../../interfaces/role.interface';
import { Menu } from '../../../menu/interfaces/menu.interface';
import { ToastService } from '../../../../core/service/toast.service';
import { PermissionService } from '../../../../core/service/permission.service';

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

  canEditPermissions = this.permissionService.can('edit', '/roles/asignar-permisos');

  roles = signal<Role[]>([]);
  menus = signal<Menu[]>([]);
  selectedRoleId = signal<number | null>(null);
  isLoading = signal(false);
  isSaving = signal(false);
  showConfirm = signal(false);

  /** Set original (tal como está guardado) y set en edición (checkboxes actuales) */
  originalMenuPermissionIds = signal(new Set<number>());
  selectedMenuPermissionIds = signal(new Set<number>());

  selectedRole = computed(() => this.roles().find((r) => r.id === this.selectedRoleId()) ?? null);

  generalMenus = computed(() => this.menus().filter((m) => !m.isSensitive));
  sensitiveMenus = computed(() => this.menus().filter((m) => m.isSensitive));

  hasChanges = computed(() => {
    const current = this.selectedMenuPermissionIds();
    const original = this.originalMenuPermissionIds();
    if (current.size !== original.size) return true;
    for (const id of current) {
      if (!original.has(id)) return true;
    }
    return false;
  });

  private summaryFor(menus: Menu[]): { menuName: string; permissions: string[] }[] {
    const current = this.selectedMenuPermissionIds();
    return menus
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
    this.rolesService.findAll(1, 100).subscribe({
      next: (res) => {
        this.roles.set(res.items);
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.showError('Error al cargar los roles.');
        this.isLoading.set(false);
      },
    });
  }

  loadMenus() {
    this.menusService.findAll(1, 100).subscribe({
      next: (res) => this.menus.set(res.items.filter((m) => m.isActive)),
      error: () => this.toastService.showError('Error al cargar los menús.'),
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

  toggle(menuPermissionId: number, checked: boolean) {
    const next = new Set(this.selectedMenuPermissionIds());
    if (checked) {
      next.add(menuPermissionId);
    } else {
      next.delete(menuPermissionId);
    }
    this.selectedMenuPermissionIds.set(next);
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
    const next = new Set(this.selectedMenuPermissionIds());
    for (const mp of menu.menuPermissions ?? []) {
      if (checked) {
        next.add(mp.id!);
      } else {
        next.delete(mp.id!);
      }
    }
    this.selectedMenuPermissionIds.set(next);
  }

  askConfirm() {
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
