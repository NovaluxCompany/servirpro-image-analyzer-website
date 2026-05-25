import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RolesService } from '../../services/roles.service';
import { MenusService } from '../../../menu/services/menus.service';
import { Role } from '../../interfaces/role.interface';
import { Menu } from '../../../menu/interfaces/menu.interface';

@Component({
  selector: 'app-role-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './role-form-modal.component.html',
})
export class RoleFormModalComponent implements OnInit, OnChanges {
  @Input() isVisible = false;
  @Input() roleData: Role | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private rolesService = inject(RolesService);
  private menusService = inject(MenusService);

  form!: FormGroup;
  availableMenus = signal<Menu[]>([]);
  isSubmitting = false;
  errorMessage = '';

  /** Set of menu_permission IDs that are currently selected */
  selectedMenuPermissionIds = new Set<number>();

  ngOnInit() {
    this.initForm();
    this.loadMenus();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isVisible'] && this.isVisible) {
      this.resetForm();
      if (this.roleData) {
        this.patchRoleData();
      }
    }
  }

  initForm() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      isActive: [true],
    });
  }

  loadMenus() {
    this.menusService.findAll(1, 100).subscribe({
      next: (res) => this.availableMenus.set(res.items.filter((m) => m.isActive)),
      error: (err) => console.error('Error loading menus', err),
    });
  }

  resetForm() {
    this.errorMessage = '';
    this.selectedMenuPermissionIds = new Set<number>();
    if (this.form) {
      this.form.reset({ isActive: true });
    }
  }

  patchRoleData() {
    this.form.patchValue({ name: this.roleData?.name, isActive: this.roleData?.isActive });
    const grantedIds = (this.roleData?.roleMenuPermissions ?? []).map((rmp) => rmp.menuPermissionId);
    this.selectedMenuPermissionIds = new Set(grantedIds);
  }

  /** Whether all menu_permissions of a menu are selected (used to drive the parent checkbox) */
  isMenuSelected(menuId: number): boolean {
    const menu = this.availableMenus().find((m) => m.id === menuId);
    if (!menu?.menuPermissions?.length) return false;
    return menu.menuPermissions.some((mp) => this.selectedMenuPermissionIds.has(mp.id!));
  }

  toggleMenu(menu: Menu, checked: boolean) {
    (menu.menuPermissions ?? []).forEach((mp) => {
      if (checked) {
        this.selectedMenuPermissionIds.add(mp.id!);
      } else {
        this.selectedMenuPermissionIds.delete(mp.id!);
      }
    });
    // trigger change detection by replacing the set
    this.selectedMenuPermissionIds = new Set(this.selectedMenuPermissionIds);
  }

  isMenuPermissionChecked(menuPermissionId: number): boolean {
    return this.selectedMenuPermissionIds.has(menuPermissionId);
  }

  toggleMenuPermission(menuPermissionId: number, checked: boolean) {
    if (checked) {
      this.selectedMenuPermissionIds.add(menuPermissionId);
    } else {
      this.selectedMenuPermissionIds.delete(menuPermissionId);
    }
    this.selectedMenuPermissionIds = new Set(this.selectedMenuPermissionIds);
  }

  onClose() {
    this.close.emit();
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.selectedMenuPermissionIds.size === 0) {
      this.errorMessage = 'Debe seleccionar al menos un menú con permisos.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = {
      ...this.form.value,
      menuPermissionIds: Array.from(this.selectedMenuPermissionIds),
    };

    const request = this.roleData
      ? this.rolesService.update(this.roleData.id!, payload)
      : this.rolesService.create(payload);

    request.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.saved.emit();
        this.onClose();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Error al guardar el rol';
      },
    });
  }
}

