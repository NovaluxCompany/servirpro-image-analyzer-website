import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../core/service/toast.service';
import { TokenService } from '../../../../core/service/token.service';
import { UsersManagementService } from '../../services/users.service';
import { SystemUser, ROLE_OPTIONS } from '../../interfaces/user.interface';

type UsersTab = 'usuarios' | 'asignar-rol';

type UserModal =
  | 'none'
  | 'create'
  | 'create-confirm'
  | 'edit'
  | 'status-confirm'
  | 'role-assign'
  | 'role-admin-warn';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersListComponent implements OnInit {
  private _service = inject(UsersManagementService);
  private _toast = inject(ToastService);
  private _tokenService = inject(TokenService);

  protected readonly ROLE_OPTIONS = ROLE_OPTIONS;

  // ── Estado general ────────────────────────────────────────────────
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly activeTab = signal<UsersTab>('usuarios');
  protected readonly activeModal = signal<UserModal>('none');
  protected readonly users = signal<SystemUser[]>([]);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly createErrorMessage = signal<string | null>(null);

  // ── Dropdown acciones ─────────────────────────────────────────────
  protected readonly openDropdownId = signal<number | null>(null);
  protected readonly dropdownPos = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  // ── Usuario seleccionado (para editar / toggle / asignar rol) ─────
  protected readonly selectedUser = signal<SystemUser | null>(null);

  // ── Formulario crear usuario ──────────────────────────────────────
  protected createForm = {
    name: '',
    email: '',
    password: '',
    documentNumber: '',
  };
  protected readonly createTouched = signal({ name: false, email: false, password: false });
  private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  protected get isCreateNameValid(): boolean {
    return !!this.createForm.name.trim();
  }

  protected get isCreateEmailValid(): boolean {
    return this.EMAIL_REGEX.test(this.createForm.email.trim());
  }

  protected get isCreatePasswordValid(): boolean {
    return !!this.createForm.password.trim();
  }

  protected onCreateBlur(field: 'name' | 'email' | 'password'): void {
    this.createTouched.update(t => ({ ...t, [field]: true }));
  }

  // ── Formulario editar usuario ─────────────────────────────────────
  protected editForm = {
    name: '',
    email: '',
    password: '',
    documentNumber: '',
  };
  protected readonly editTouched = signal({ name: false, email: false });

  protected get isEditNameValid(): boolean {
    return !!this.editForm.name.trim();
  }

  protected get isEditEmailValid(): boolean {
    return this.EMAIL_REGEX.test(this.editForm.email.trim());
  }

  protected onEditBlur(field: 'name' | 'email'): void {
    this.editTouched.update(t => ({ ...t, [field]: true }));
  }

  // ── Asignar rol ───────────────────────────────────────────────────
  protected selectedRoleId = signal<number | null>(null);

  // ── Filtros tab Usuarios ──────────────────────────────────────────
  protected readonly filterName = signal('');
  protected readonly filterEmail = signal('');

  // ── Paginación ────────────────────────────────────────────────────
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(10);

  // ── Computed ──────────────────────────────────────────────────────
  protected readonly isAdmin = computed(() =>
    this._tokenService.hasRole('Administrador')
  );

  protected readonly filteredUsers = computed(() => {
    const all = this.users();
    const name = this.filterName().toLowerCase().trim();
    const email = this.filterEmail().toLowerCase().trim();
    if (!name && !email) return all;
    return all.filter(u => {
      if (name && !(u.name ?? '').toLowerCase().includes(name)) return false;
      if (email && !(u.email ?? '').toLowerCase().includes(email)) return false;
      return true;
    });
  });

  protected readonly totalItems = computed(() => this.filteredUsers().length);
  protected readonly totalPages = computed(() =>
    Math.ceil((this.totalItems() || 1) / (this.pageSize() || 1))
  );

  protected readonly currentUsers = computed(() => {
    const all = this.filteredUsers();
    const start = (this.currentPage() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  protected get pageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }
    return range;
  }

  protected readonly selectedRoleLabel = computed(() => {
    const id = this.selectedRoleId();
    return ROLE_OPTIONS.find(r => r.id === id)?.label ?? '';
  });

  ngOnInit(): void {
    if (!this.isAdmin()) {
      this._toast.showError('Solo los Administradores pueden acceder a este módulo.');
      return;
    }
    this.loadUsers();
  }

  // ── Carga ─────────────────────────────────────────────────────────
  protected loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this._service.getUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.errorMessage.set(err.message);
        this.isLoading.set(false);
      },
    });
  }

  // ── Tabs ──────────────────────────────────────────────────────────
  protected changeTab(tab: UsersTab): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.filterName.set('');
    this.filterEmail.set('');
  }

  // ── Dropdown ──────────────────────────────────────────────────────
  protected toggleDropdown(id: number, btn: HTMLElement): void {
    if (this.openDropdownId() === id) {
      this.openDropdownId.set(null);
      return;
    }
    const rect = btn.getBoundingClientRect();
    this.dropdownPos.set({ top: rect.bottom + 4, left: rect.left });
    this.openDropdownId.set(id);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openDropdownId.set(null);
  }

  // ── Crear usuario ─────────────────────────────────────────────────
  protected openCreateModal(): void {
    this.createForm = { name: '', email: '', password: '', documentNumber: '' };
    this.createErrorMessage.set(null);
    this.createTouched.set({ name: false, email: false, password: false });
    this.activeModal.set('create');
  }

  protected submitCreate(): void {
    this.createTouched.set({ name: true, email: true, password: true });
    if (!this.isCreateNameValid || !this.isCreateEmailValid || !this.isCreatePasswordValid) {
      return;
    }
    this.createErrorMessage.set(null);
    this.activeModal.set('create-confirm');
  }

  protected confirmCreate(): void {
    this.isSubmitting.set(true);
    this.createErrorMessage.set(null);
    this._service.createUser({
      name: this.createForm.name,
      email: this.createForm.email,
      password: this.createForm.password,
      documentNumber: this.createForm.documentNumber || undefined,
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.activeModal.set('none');
        this._toast.showSuccess(`Usuario ${this.createForm.email} creado correctamente.`);
        this.loadUsers();
      },
      error: (err: Error) => {
        this.isSubmitting.set(false);
        this.createErrorMessage.set(err.message);
      },
    });
  }

  // ── Editar usuario ────────────────────────────────────────────────
  protected openEditModal(user: SystemUser): void {
    this.selectedUser.set(user);
    this.editForm = {
      name: user.name ?? '',
      email: user.email ?? '',
      password: '',
      documentNumber: user.documentNumber ?? '',
    };
    this.editTouched.set({ name: false, email: false });
    this.activeModal.set('edit');
  }

  protected submitEdit(): void {
    this.editTouched.set({ name: true, email: true });
    if (!this.isEditNameValid || !this.isEditEmailValid) {
      return;
    }
    const user = this.selectedUser();
    if (!user) return;
    this.isSubmitting.set(true);

    const payload: any = {
      name: this.editForm.name,
      email: this.editForm.email,
      documentNumber: this.editForm.documentNumber || undefined,
    };
    if (this.editForm.password) {
      payload.password = this.editForm.password;
    }

    this._service.updateUser(user.id, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.activeModal.set('none');
        this._toast.showSuccess('Usuario actualizado correctamente.');
        this.loadUsers();
      },
      error: (err: Error) => {
        this.isSubmitting.set(false);
        this._toast.showError(err.message);
      },
    });
  }

  // ── Toggle estado ─────────────────────────────────────────────────
  protected openStatusModal(user: SystemUser): void {
    this.selectedUser.set(user);
    this.activeModal.set('status-confirm');
  }

  protected confirmToggleStatus(): void {
    const user = this.selectedUser();
    if (!user) return;
    this.isSubmitting.set(true);
    this._service.toggleStatus(user.id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        const action = user.isActive ? 'inhabilitado' : 'habilitado';
        this._toast.showSuccess(`Usuario ${action} correctamente.`);
        this.activeModal.set('none');
        this.loadUsers();
      },
      error: (err: Error) => {
        this.isSubmitting.set(false);
        this._toast.showError(err.message);
        this.activeModal.set('none');
      },
    });
  }

  // ── Asignar rol ───────────────────────────────────────────────────
  protected openRoleModal(user: SystemUser): void {
    this.selectedUser.set(user);
    this.selectedRoleId.set(user.roleId ?? null);
    this.activeModal.set('role-assign');
  }

  protected selectRole(id: number): void {
    this.selectedRoleId.set(id);
  }

  protected submitRoleAssign(): void {
    if (this.isSubmitting()) return;
    const roleId = this.selectedRoleId();
    if (!roleId) {
      this._toast.showError('Selecciona un rol para continuar.');
      return;
    }
    if (roleId === 1) {
      this.activeModal.set('role-admin-warn');
      return;
    }
    this.confirmRoleAssign();
  }

  protected confirmRoleAssign(): void {
    if (this.isSubmitting()) return;
    const user = this.selectedUser();
    const roleId = this.selectedRoleId();
    if (!user || !roleId) return;
    this.isSubmitting.set(true);
    this._service.assignRole(user.id, roleId).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this._toast.showSuccess(`Rol "${this.selectedRoleLabel()}" asignado correctamente a ${user.name ?? user.email}.`);
        this.activeModal.set('none');
        this.loadUsers();
      },
      error: (err: Error) => {
        this.isSubmitting.set(false);
        this._toast.showError(err.message);
        this.activeModal.set('none');
      },
    });
  }

  // ── Cerrar modales ────────────────────────────────────────────────
  protected closeModal(): void {
    this.activeModal.set('none');
    this.selectedUser.set(null);
    this.createErrorMessage.set(null);
    this.createTouched.set({ name: false, email: false, password: false });
    this.editTouched.set({ name: false, email: false });
  }

  // ── Paginación ────────────────────────────────────────────────────
  protected previousPage(): void {
    if (this.currentPage() > 1) this.currentPage.update(p => p - 1);
  }

  protected nextPage(): void {
    if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1);
  }

  protected goToPage(page: number): void {
    if (page > 0 && page <= this.totalPages()) this.currentPage.set(page);
  }

  // ── Filtros ───────────────────────────────────────────────────────
  protected setFilterName(value: string): void {
    this.filterName.set(value);
    this.currentPage.set(1);
  }

  protected setFilterEmail(value: string): void {
    this.filterEmail.set(value);
    this.currentPage.set(1);
  }

  // ── Utilidades ────────────────────────────────────────────────────
  protected trackById(_: number, item: SystemUser): number {
    return item.id;
  }
}
