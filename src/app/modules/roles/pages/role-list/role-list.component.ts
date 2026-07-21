import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RolesService } from '../../services/roles.service';
import { Role } from '../../interfaces/role.interface';
import { RoleFormModalComponent } from '../../components/role-form-modal/role-form-modal.component';
import { AssignPermissionsComponent } from '../../components/assign-permissions/assign-permissions.component';
import { ToastService } from '../../../../core/service/toast.service';
import { PermissionService } from '../../../../core/service/permission.service';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [CommonModule, RoleFormModalComponent, AssignPermissionsComponent],
  templateUrl: './role-list.component.html',
})
export class RoleListComponent implements OnInit {
  private rolesService = inject(RolesService);
  private toastService = inject(ToastService);
  private permissionService = inject(PermissionService);
  protected Math = Math;

  canViewRoles = this.permissionService.can('view', '/roles');
  canAssignPermissions = this.permissionService.can('view', '/roles/asignar-permisos');

  activeTab = signal<'roles' | 'permissions'>(this.canViewRoles ? 'roles' : 'permissions');

  roles = signal<Role[]>([]);
  totalItems = signal(0);
  currentPage = signal(1);
  pageSize = signal(10);
  showFormModal = signal(false);
  selectedRole = signal<Role | null>(null);
  isLoading = signal(false);
  roleToToggle = signal<Role | null>(null);
  isToggling = signal(false);

  openDropdownId = signal<number | null>(null);
  dropdownPos = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  @HostListener('document:click')
  onDocumentClick() {
    this.closeDropdown();
  }

  ngOnInit() {
    this.loadRoles();
  }

  loadRoles() {
    this.isLoading.set(true);
    this.rolesService.findAll(this.currentPage(), this.pageSize()).subscribe({
      next: (response) => {
        this.roles.set(response.items);
        this.totalItems.set(response.meta.totalItems);
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.showError('Error al cargar los roles. Intenta de nuevo.');
        this.isLoading.set(false);
      }
    });
  }

  toggleDropdown(id: number, btn: HTMLElement) {
    if (this.openDropdownId() === id) {
      this.closeDropdown();
      return;
    }
    const rect = btn.getBoundingClientRect();
    this.dropdownPos.set({ top: rect.bottom + 4, left: rect.left });
    this.openDropdownId.set(id);
  }

  closeDropdown() {
    this.openDropdownId.set(null);
  }

  openCreateModal() {
    this.selectedRole.set(null);
    this.showFormModal.set(true);
  }

  openEditModal(role: Role) {
    this.selectedRole.set(role);
    this.showFormModal.set(true);
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.loadRoles();
  }

  onSaved() {
    this.showFormModal.set(false);
    this.toastService.showSuccess('Rol guardado correctamente.');
    this.loadRoles();
  }

  confirmToggle(role: Role) {
    this.roleToToggle.set(role);
  }

  cancelToggle() {
    if (this.isToggling()) return;
    this.roleToToggle.set(null);
  }

  toggleRoleStatus() {
    const role = this.roleToToggle();
    if (!role?.id || this.isToggling()) return;
    this.isToggling.set(true);
    this.rolesService.update(role.id, { isActive: !role.isActive }).subscribe({
      next: () => {
        this.toastService.showSuccess(
          role.isActive ? 'Rol deshabilitado correctamente.' : 'Rol habilitado correctamente.'
        );
        this.isToggling.set(false);
        this.roleToToggle.set(null);
        this.loadRoles();
      },
      error: () => {
        this.toastService.showError('No se pudo actualizar el estado del rol. Intenta de nuevo.');
        this.isToggling.set(false);
        this.roleToToggle.set(null);
      }
    });
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems() / this.pageSize());
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  getMenusList(role: Role): string {
    if (!role.roleMenuPermissions?.length) return '-';
    const menuNames = role.roleMenuPermissions
      .map((rmp) => rmp.menuPermission?.menu?.name)
      .filter((name): name is string => !!name);
    const unique = [...new Set(menuNames)];
    return unique.length ? unique.join(', ') : '-';
  }
}
