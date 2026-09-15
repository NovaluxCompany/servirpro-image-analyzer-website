import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { DocumentUploadsService } from '../../services/document-uploads.service';
import { DocumentType, DocumentUploadItem, DocumentUploadStatus } from '../../interfaces/document-upload.interface';
import { DocumentUploadStatusBadgeComponent } from '../../components/document-upload-status-badge/document-upload-status-badge';
import { DocumentUploadModalComponent } from '../../components/document-upload-modal/document-upload-modal';
import { ToastService } from '../../../../core/service/toast.service';

@Component({
  selector: 'app-document-uploads-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DocumentUploadStatusBadgeComponent, DocumentUploadModalComponent],
  templateUrl: './document-uploads-list.html',
})
export class DocumentUploadsListComponent implements OnInit {
  private _service = inject(DocumentUploadsService);
  private _toast = inject(ToastService);
  private _router = inject(Router);

  items = signal<DocumentUploadItem[]>([]);
  documentTypes = signal<DocumentType[]>([]);
  isLoading = signal(false);

  currentPage = signal(1);
  pageSize = signal(20);
  totalItems = signal(0);
  totalPages = signal(0);

  filterStatus: DocumentUploadStatus | '' = '';
  filterDocumentTypeId: number | '' = '';
  filterSearch = '';
  filterDateFrom = '';
  filterDateTo = '';

  showUploadModal = signal(false);

  private filterSubject = new Subject<void>();

  get hasActiveFilters(): boolean {
    return !!(this.filterStatus || this.filterDocumentTypeId || this.filterSearch || this.filterDateFrom || this.filterDateTo);
  }

  ngOnInit(): void {
    this.filterSubject.pipe(debounceTime(400)).subscribe(() => {
      this.currentPage.set(1);
      this.loadItems();
    });
    this._service.getTypes().subscribe((types) => this.documentTypes.set(types));
    this.loadItems();
  }

  onFilterChange(): void {
    this.filterSubject.next();
  }

  clearFilters(): void {
    this.filterStatus = '';
    this.filterDocumentTypeId = '';
    this.filterSearch = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.currentPage.set(1);
    this.loadItems();
  }

  loadItems(): void {
    this.isLoading.set(true);
    this._service
      .list({
        page: this.currentPage(),
        pageSize: this.pageSize(),
        status: this.filterStatus || undefined,
        documentTypeId: this.filterDocumentTypeId || undefined,
        search: this.filterSearch || undefined,
        dateFrom: this.filterDateFrom || undefined,
        dateTo: this.filterDateTo || undefined,
      })
      .subscribe({
        next: (response) => {
          this.items.set(response.data);
          this.totalItems.set(response.total);
          this.totalPages.set(Math.ceil(response.total / response.pageSize));
          this.isLoading.set(false);
        },
        error: (err) => {
          this._toast.showError(err.message ?? 'No se pudo cargar el listado de cargues.');
          this.isLoading.set(false);
        },
      });
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
      this.loadItems();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((p) => p + 1);
      this.loadItems();
    }
  }

  viewDetail(item: DocumentUploadItem): void {
    this._router.navigate(['/afiliados/cargue-documentos', item.id]);
  }

  goBack(): void {
    this._router.navigate(['/afiliados']);
  }

  onUploaded(): void {
    this.showUploadModal.set(false);
    this.loadItems();
  }
}
