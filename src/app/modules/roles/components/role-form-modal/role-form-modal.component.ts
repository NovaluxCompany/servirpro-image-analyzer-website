import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RolesService } from '../../services/roles.service';
import { Role } from '../../interfaces/role.interface';

@Component({
  selector: 'app-role-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './role-form-modal.component.html',
})
export class RoleFormModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Input() roleData: Role | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private rolesService = inject(RolesService);

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });
  isSubmitting = false;
  errorMessage = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isVisible'] && this.isVisible) {
      this.resetForm();
      if (this.roleData) {
        this.patchRoleData();
      }
    }
  }

  resetForm() {
    this.errorMessage = '';
    this.form.reset({ name: '', description: '' });
  }

  patchRoleData() {
    this.form.patchValue({
      name: this.roleData?.name,
      description: this.roleData?.description ?? '',
    });
  }

  onClose() {
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

    const request = this.roleData
      ? this.rolesService.update(this.roleData.id!, payload)
      : this.rolesService.create({ ...payload, isActive: true });

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
