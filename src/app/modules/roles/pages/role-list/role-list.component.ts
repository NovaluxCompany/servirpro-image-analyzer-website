import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RolesService } from '../../services/roles.service';
import { Role } from '../../interfaces/role.interface';
import { RoleFormModalComponent } from '../../components/role-form-modal/role-form-modal.component';
import { ToastService } from '../../../../core/service/toast.service';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [CommonModule, RoleFormModalComponent],
  templateUrl: './role-list.component.html',
})
export class RoleListComponent implements OnInit {
  private rolesService = inject(RolesService);
  private toastService = inject(ToastService);
  protected Math = Math;

  roles = signal<Role[]>([]);
  totalItems = signal(0);
  currentPage = signal(1);
  pageSize = signal(10);
  showFormModal = signal(false);
  selectedRole = signal<Role | null>(null);
  isLoading = signal(false);
  roleToDelete = signal<Role | null>(null);

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

  confirmDelete(role: Role) {
    this.roleToDelete.set(role);
  }

  cancelDelete() {
    this.roleToDelete.set(null);
  }

  deleteRole() {
    const role = this.roleToDelete();
    if (!role?.id) return;
    this.rolesService.remove(role.id).subscribe({
      next: () => {
        this.toastService.showSuccess('Rol eliminado correctamente.');
        this.roleToDelete.set(null);
        this.loadRoles();
      },
      error: () => {
        this.toastService.showError('No se pudo eliminar el rol. Intenta de nuevo.');
        this.roleToDelete.set(null);
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
    if (!role.roleMenuPermissions?.length) return 'Ninguno';
    const menuNames = role.roleMenuPermissions
      .map((rmp) => rmp.menuPermission?.menu?.name)
      .filter((name): name is string => !!name);
    const unique = [...new Set(menuNames)];
    return unique.length ? unique.join(', ') : 'Ninguno';
  }
}
