import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/service/toast.service';
import { PermissionService } from '../../../core/service/permission.service';
import { UpdateCompanyService } from '../services/update-company.service';
import {
  ValidationResponse,
  ExecutionResponse,
  HistoryRow,
} from '../interfaces/update-company.interface';

@Component({
  selector: 'app-update-company-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './update-company-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateCompanyList implements OnInit {
  private readonly _service = inject(UpdateCompanyService);
  private readonly _toast = inject(ToastService);
  private readonly _permission = inject(PermissionService);

  // Estados generales
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly isDragging = signal(false);

  // Estados de carga de archivo
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly validationResult = signal<ValidationResponse | null>(null);
  protected readonly executionResult = signal<ExecutionResponse | null>(null);

  // Historial de trazabilidad
  protected readonly history = signal<HistoryRow[]>([]);
  protected readonly historyTotal = signal(0);
  protected readonly historyPage = signal(1);
  protected readonly historyLimit = signal(10);
  protected readonly historyLoading = signal(false);

  // Modales
  protected readonly showConfirmationModal = signal(false);
  protected readonly showErrorDetailModal = signal(false);

  // Detalle del log de error para el modal
  protected readonly activeErrorDetail = signal<{
    idNumber: string;
    fullName: string;
    newCompany: string;
    operator: string;
    fileName: string;
    date: string;
    message: string;
  } | null>(null);

  // Permisos dinámicos desde la base de datos
  protected readonly canUpload = computed(() =>
    this._permission.can('create', '/actualizar-compania')
  );

  protected readonly canViewHistory = computed(() =>
    this._permission.can('export', '/actualizar-compania') || this._permission.can('view', '/actualizar-compania')
  );

  protected readonly canExportHistory = computed(() =>
    this._permission.can('export', '/actualizar-compania')
  );

  // Paginación
  protected readonly totalPages = computed(() =>
    Math.ceil((this.historyTotal() || 1) / (this.historyLimit() || 1))
  );

  protected get pageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.historyPage();
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }
    return range;
  }

  ngOnInit(): void {
    if (this.canViewHistory()) {
      this.loadHistory();
    }
  }

  // ── Drag & Drop ───────────────────────────────────────────────────
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.canUpload()) {
      this.isDragging.set(true);
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (!this.canUpload()) {
      this._toast.showError('No tienes permisos para subir archivos.');
      return;
    }

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileChange(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  private handleFile(file: File): void {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') {
      this._toast.showError('Formato de archivo inválido. Solo se admiten archivos .xlsx');
      return;
    }

    this.selectedFile.set(file);
    this.validationResult.set(null);
    this.executionResult.set(null);
    this.validateFile();
  }

  triggerFileInput(inputEl: HTMLInputElement): void {
    if (!this.canUpload()) {
      this._toast.showError('No tienes permisos para realizar esta acción.');
      return;
    }
    inputEl.click();
  }

  clearFile(inputEl?: HTMLInputElement): void {
    this.selectedFile.set(null);
    this.validationResult.set(null);
    this.executionResult.set(null);
    if (inputEl) {
      inputEl.value = '';
    }
  }

  // ── Acciones de API ────────────────────────────────────────────────
  validateFile(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isLoading.set(true);
    this._service.validateFile(file).subscribe({
      next: (res) => {
        this.validationResult.set(res);
        this.isLoading.set(false);
        if (res.valido) {
          this._toast.showSuccess('Archivo pre-validado con éxito');
        } else {
          this._toast.showError('El archivo contiene errores de validación');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this._toast.showError(err.message || 'Error al validar el archivo.');
      },
    });
  }

  openConfirmation(): void {
    if (!this.canUpload()) return;
    this.showConfirmationModal.set(true);
  }

  closeConfirmation(): void {
    this.showConfirmationModal.set(false);
  }

  executeUpload(inputEl?: HTMLInputElement): void {
    const file = this.selectedFile();
    if (!file || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.showConfirmationModal.set(false);

    this._service.executeUpload(file).subscribe({
      next: (res) => {
        this.executionResult.set(res);
        this.isSubmitting.set(false);
        this.selectedFile.set(null);
        if (inputEl) {
          inputEl.value = '';
        }
        
        const total = res.exitosos + res.fallidos + res.no_encontrados + res.inactivos_omitidos + res.ordinarios_omitidos;
        this._toast.showSuccess(`Procesado finalizado: ${res.exitosos} exitosos de ${total} registros.`);
        
        if (this.canViewHistory()) {
          this.historyPage.set(1);
          this.loadHistory();
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this._toast.showError(err.message || 'Error al ejecutar la actualización.');
      },
    });
  }

  // ── Descarga de Excel ──────────────────────────────────────────────
  downloadTemplate(): void {
    this._toast.showInfo('Descargando plantilla...');
    this._service.downloadTemplate().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plantilla_actualizar_empresa.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this._toast.showSuccess('Plantilla descargada con éxito');
      },
      error: () => {
        this._toast.showError('Error al descargar la plantilla.');
      },
    });
  }

  downloadSummaryReport(): void {
    const result = this.executionResult();
    if (!result || !this.canExportHistory()) return;

    this._toast.showInfo('Descargando resumen de resultados...');
    this._service.downloadSummaryExcel(result.detalle).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `resumen_actualizacion_empresa_${dateStr}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this._toast.showSuccess('Resumen descargado con éxito');
      },
      error: () => {
        this._toast.showError('Error al descargar el resumen.');
      },
    });
  }

  // ── Historial ──────────────────────────────────────────────────────
  loadHistory(): void {
    this.historyLoading.set(true);
    this._service.getHistory(this.historyPage(), this.historyLimit()).subscribe({
      next: (res) => {
        this.history.set(res.data);
        this.historyTotal.set(res.total);
        this.historyLoading.set(false);
      },
      error: (err) => {
        this.historyLoading.set(false);
        this._toast.showError(err.message || 'Error al cargar el historial.');
      },
    });
  }

  previousPage(): void {
    if (this.historyPage() > 1 && !this.historyLoading()) {
      this.historyPage.update((p) => p - 1);
      this.loadHistory();
    }
  }

  nextPage(): void {
    if (this.historyPage() < this.totalPages() && !this.historyLoading()) {
      this.historyPage.update((p) => p + 1);
      this.loadHistory();
    }
  }

  goToPage(page: number): void {
    if (page > 0 && page <= this.totalPages() && page !== this.historyPage() && !this.historyLoading()) {
      this.historyPage.set(page);
      this.loadHistory();
    }
  }

  // ── Modal de Errores ───────────────────────────────────────────────
  openErrorDetail(row: HistoryRow): void {
    this.activeErrorDetail.set({
      idNumber: row.documentNumber || 'N/A',
      fullName: row.fullName || 'Asociación no disponible',
      newCompany: row.newCompany || 'N/A',
      operator: row.operator || 'Sistema',
      fileName: row.fileName || 'Carga Masiva',
      date: row.createdAt,
      message: row.errorMessage || 'Error desconocido al actualizar la empresa.',
    });
    this.showErrorDetailModal.set(true);
  }

  closeErrorDetail(): void {
    this.showErrorDetailModal.set(false);
    this.activeErrorDetail.set(null);
  }

  // ── Utilidades ────────────────────────────────────────────────────
  protected formatDate(dateString: string): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Bogota',
      }).format(date);
    } catch {
      return dateString || '-';
    }
  }
}
