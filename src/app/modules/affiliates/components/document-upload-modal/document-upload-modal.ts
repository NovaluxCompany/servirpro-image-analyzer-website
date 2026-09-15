import { Component, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentUploadsService } from '../../services/document-uploads.service';
import { DocumentType, UploadItemError } from '../../interfaces/document-upload.interface';
import { ToastService } from '../../../../core/service/toast.service';

interface PendingFile {
  file: File;
  error: string | null;
}

@Component({
  selector: 'app-document-upload-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document-upload-modal.html',
})
export class DocumentUploadModalComponent {
  private _service = inject(DocumentUploadsService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  uploaded = output<void>();
  cancelled = output<void>();

  documentTypes = signal<DocumentType[]>([]);
  selectedTypeId: number | null = null;
  pendingFiles = signal<PendingFile[]>([]);
  isSubmitting = signal(false);

  constructor() {
    effect(() => {
      if (this.isVisible()) {
        this.selectedTypeId = null;
        this.pendingFiles.set([]);
        this.isSubmitting.set(false);
        this.loadTypes();
      }
    });
  }

  private loadTypes(): void {
    this._service.getTypes().subscribe({
      next: (types) => this.documentTypes.set(types),
      error: () => this._toast.showError('No se pudieron cargar los tipos de documento.'),
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const newFiles: PendingFile[] = Array.from(input.files).map((file) => ({ file, error: null }));
    this.pendingFiles.update((current) => [...current, ...newFiles]);
    input.value = '';
  }

  removeFile(index: number): void {
    this.pendingFiles.update((current) => current.filter((_, i) => i !== index));
  }

  submit(): void {
    if (!this.selectedTypeId) {
      this._toast.showError('Selecciona el documento a cargar.');
      return;
    }
    if (this.pendingFiles().length === 0) {
      this._toast.showError('Adjunta al menos un archivo PDF.');
      return;
    }

    this.isSubmitting.set(true);
    const files = this.pendingFiles().map((p) => p.file);

    this._service.upload(this.selectedTypeId, files).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        if (response.errors.length === 0) {
          this._toast.showSuccess('Archivos cargados correctamente, esperando respuesta del flujo de envío a WhatsApp.');
          this.uploaded.emit();
        } else {
          this.applyErrors(response.errors);
          this._toast.showError('Algunos archivos no pasaron la validación. Revisa el detalle en cada uno.');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this._toast.showError(err.message ?? 'No se pudo procesar el cargue.');
      },
    });
  }

  private applyErrors(errors: UploadItemError[]): void {
    const errorByFileName = new Map(errors.map((e) => [e.fileName, e.reason]));
    this.pendingFiles.update((current) =>
      current
        // Los archivos que sí pasaron ya quedaron creados en el backend; se
        // quitan de la lista pendiente para que solo queden los que fallaron.
        .filter((p) => errorByFileName.has(p.file.name))
        .map((p) => ({ ...p, error: errorByFileName.get(p.file.name) ?? null })),
    );
  }

  close(): void {
    this.cancelled.emit();
  }
}
