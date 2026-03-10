import { Component, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TransactionsService } from '../../services/transactions.service';
import { AffiliatesFormComponent } from '../../components/affiliates-form/affiliates-form';
import { ImageUploaderComponent } from '../../components/image-uploader/image-uploader';

@Component({
  selector: 'app-transaction-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AffiliatesFormComponent, ImageUploaderComponent],
  templateUrl: './transaction-create.html'
})
export class TransactionCreateComponent {
  @ViewChild(AffiliatesFormComponent) affiliatesForm!: AffiliatesFormComponent;

  private _fb = inject(FormBuilder);
  private _transactionsService = inject(TransactionsService);
  private _router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  uploadedImages = signal<File[]>([]);

  form = this._fb.group({
    amountPaid: [0, [Validators.required, Validators.min(1)]]
  });

  onImagesChanged(files: File[]): void {
    this.uploadedImages.set(files);
  }

  onSubmit(): void {
    this.errorMessage.set(null);

    // Obtener referencia del formulario de afiliados
    const reference = this.affiliatesForm.getReference();
    if (!reference) {
      this.errorMessage.set('Debes ingresar una referencia de transacción');
      return;
    }

    // Validar formulario principal
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Por favor completa todos los campos requeridos');
      return;
    }

    // Validar afiliados
    if (!this.affiliatesForm.isValid()) {
      this.errorMessage.set('Debes seleccionar al menos un afiliado');
      return;
    }

    // Validar imágenes
    if (this.uploadedImages().length === 0) {
      this.errorMessage.set('Debes subir al menos una imagen de comprobante');
      return;
    }

    // Construir FormData
    const formData = new FormData();
    const { amountPaid } = this.form.value;

    formData.append('reference', reference);
    formData.append('amountPaid', amountPaid!.toString());

    // Obtener afiliados seleccionados
    const selectedAffiliates = this.affiliatesForm.getSelectedAffiliates();
    formData.append('affiliates', JSON.stringify(selectedAffiliates));

    // Agregar imágenes
    this.uploadedImages().forEach(file => {
      formData.append('images', file);
    });

    // Enviar al servidor
    this.isLoading.set(true);

    this._transactionsService.createTransaction(formData).subscribe({
      next: (transaction) => {
        this.isLoading.set(false);
        this._router.navigate(['/transacciones'], {
          state: {
            successMessage: `Transacción ${transaction.reference} creada exitosamente. Procesando con IA...`
          }
        });
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error.message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  onCancel(): void {
    this._router.navigate(['/transacciones']);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);

    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (field?.hasError('min')) {
      return 'El valor debe ser mayor a 0';
    }
    return '';
  }
}
