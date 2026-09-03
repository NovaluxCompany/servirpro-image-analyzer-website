import { Component, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TransactionsService } from '../../services/transactions.service';
import { AffiliatesFormComponent } from '../../components/affiliates-form/affiliates-form';
import { ImageUploaderComponent } from '../../components/image-uploader/image-uploader';
import { Affiliate } from '../../interfaces/affiliate.interface';
import { PermissionService } from '../../../../core/service/permission.service';
import { ToastService } from '../../../../core/service/toast.service';

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
  private _permission = inject(PermissionService);
  private _toast = inject(ToastService);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  uploadedImages = signal<File[]>([]);

  ngOnInit(): void {
    // Defensa adicional: si llegó aquí sin permiso (guard fallido), redirige sin toast duplicado
    if (!this._permission.can('create', '/transacciones')) {
      this._router.navigate(['/transacciones']);
    }
  }

  form = this._fb.group({
    totalValue: [{ value: 0, disabled: true }, [Validators.required, Validators.min(1)]],
    amountPaid: [{ value: 0, disabled: true }, [Validators.required, Validators.min(1)]],
    observation: ['', [Validators.maxLength(2000)]]
  });

  onAffiliatesChanged(affiliates: Affiliate[]): void {
    const totalPrice = affiliates.reduce((sum, affiliate) => sum + affiliate.price - (affiliate.discount || 0), 0);
    this.form.get('totalValue')?.setValue(totalPrice);
    this.updateValuePaid();
  }

  onImagesChanged(files: File[]): void {
    this.uploadedImages.set(files);
  }

  private updateValuePaid(): void {
    const totalValue = this.form.get('totalValue')?.value || 0;
    this.form.get('amountPaid')?.setValue(totalValue);
  }

  /** Bloquea el botón de crear transacción mientras algún afiliado
   *  seleccionado ya tenga una transacción registrada este mes — respaldo
   *  por si el usuario no ve el aviso inline en la fila. */
  isSubmitBlocked(): boolean {
    return this.isLoading() || !!this.affiliatesForm?.hasDuplicates();
  }

  onSubmit(): void {
    this.errorMessage.set(null);

    if (this.affiliatesForm.hasDuplicates()) {
      this.errorMessage.set(
        'Uno o más afiliados seleccionados ya tienen una transacción registrada este mes. Quítalos de la selección antes de continuar.',
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

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
    const { totalValue, amountPaid, observation } = this.form.getRawValue();

    formData.append('reference', reference);
    formData.append('totalValue', totalValue!.toString());
    formData.append('amountPaid', amountPaid!.toString());

    // Agregar observación si existe
    if (observation && observation.trim()) {
      formData.append('observation', observation.trim());
    }

    // Obtener afiliados seleccionados
    const selectedAffiliates = this.affiliatesForm.getSelectedAffiliates().map(affiliate => ({
      ...affiliate,
      charge: affiliate.profession ?? affiliate.charge ?? null,
      arl: affiliate.arl !== undefined ? affiliate.arl : null,
    }));
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
        // A partir de aquí la transacción YA se mandó a crear: el error es
        // de la petición (backend/Siigo/inesperado), no de datos mal
        // llenados en el formulario — se muestra por notificación en vez
        // del texto rojo inline (ese queda reservado para validación
        // mientras se completa el formulario, ver validaciones arriba).
        this._toast.showError(error.message);
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
    if (field?.hasError('maxlength')) {
      const maxLength = field.getError('maxlength').requiredLength;
      return `El texto no puede exceder ${maxLength} caracteres`;
    }
    return '';
  }
}
