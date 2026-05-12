import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RolesService } from '../../services/roles.service';
import { Role } from '../../interfaces/role.interface';
import { RoleFormModalComponent } from '../../components/role-form-modal/role-form-modal.component';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [CommonModule, RoleFormModalComponent],
  templateUrl: './role-list.component.html',
})
export class RoleListComponent implements OnInit {
  private rolesService = inject(RolesService);
  protected Math = Math;

  roles = signal<Role[]>([]);
  totalItems = signal(0);
  currentPage = signal(1);
  pageSize = signal(10);
  showFormModal = signal(false);
  selectedRole = signal<Role | null>(null);

  ngOnInit() {
    this.loadRoles();
  }

  loadRoles() {
    this.rolesService.findAll(this.currentPage(), this.pageSize()).subscribe({
      next: (response) => {
        this.roles.set(response.items);
        this.totalItems.set(response.meta.totalItems);
      },
      error: (err) => console.error('Error loading roles', err)
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
    this.loadRoles();
  }

  deleteRole(id: number) {
    if (confirm('¿Está seguro de eliminar este rol?')) {
      this.rolesService.remove(id).subscribe({
        next: () => this.loadRoles(),
        error: (err) => console.error('Error deleting role', err)
      });
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems() / this.pageSize());
  }

  get pages(): number[] {
    const total = this.totalPages;
    return Array.from({ length: total }, (_, i) => i + 1);
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
