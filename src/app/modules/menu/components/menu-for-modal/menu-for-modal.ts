import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MenusService } from '../../services/menus.service';
import { Menu, Permission } from '../../interfaces/menu.interface';

@Component({
  selector: 'app-menu-for-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './menu-for-modal.html',
  styles: ``,
})
export class MenuForModal implements OnInit, OnChanges {
  @Input() isVisible = false;
  @Input() menuData: Menu | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private menusService = inject(MenusService);

  form!: FormGroup;
  isSubmitting = false;
  errorMessage = '';
  availablePermissions: Permission[] = [];

  ngOnInit() {
    this.initForm();
    this.menusService.getPermissions().subscribe({
      next: (perms) => (this.availablePermissions = perms),
      error: () => (this.availablePermissions = []),
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['menuData'] && this.form) {
      if (this.menuData) {
        const currentIds = (this.menuData.menuPermissions ?? []).map((mp) => mp.permissionId);
        this.form.patchValue({
          name: this.menuData.name,
          icon: this.menuData.icon ?? '',
          path: this.menuData.path,
          isActive: this.menuData.isActive,
          permissionIds: currentIds,
        });
      } else {
        this.form.reset({ isActive: true, permissionIds: [] });
      }
    }
  }

  initForm() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      icon: ['', Validators.required],
      path: ['', Validators.required],
      isActive: [true],
      permissionIds: [[], [Validators.required, Validators.minLength(1)]],
    });
  }

  onPermissionChange(id: number, checked: boolean) {
    const current: number[] = [...this.form.get('permissionIds')!.value];
    if (checked) {
      if (!current.includes(id)) current.push(id);
    } else {
      const idx = current.indexOf(id);
      if (idx > -1) current.splice(idx, 1);
    }
    this.form.get('permissionIds')!.setValue(current);
    this.form.get('permissionIds')!.markAsTouched();
  }

  isPermissionChecked(id: number): boolean {
    return this.form.get('permissionIds')!.value.includes(id);
  }

  onClose(): void {
    this.errorMessage = '';
    this.form.reset({ isActive: true, permissionIds: [] });
    this.close.emit();
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = this.form.value;

    if (this.menuData) {
      this.menusService.update(this.menuData.id!, payload).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.saved.emit();
          this.onClose();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Error al actualizar el menú';
        },
      });
    } else {
      this.menusService.create(payload).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.saved.emit();
          this.onClose();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Error al crear el menú';
        },
      });
    }
  }
}
