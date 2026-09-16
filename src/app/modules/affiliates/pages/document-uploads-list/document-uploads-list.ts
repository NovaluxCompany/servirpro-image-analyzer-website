import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { DocumentUploadsService } from '../../services/document-uploads.service';
import { DocumentType, DocumentUploadItem, DocumentUploadStatus } from '../../interfaces/document-upload.interface';
import { DocumentUploadStatusBadgeComponent } from '../../components/document-upload-status-badge/document-upload-status-badge';
import { DocumentUploadModalComponent } from '../../components/document-upload-modal/document-upload-modal';
import { ToastService } from '../../../../core/service/toast.service';
import { ConfigGeneralService } from '../../../../core/service/config-general.service';
import { PageSizeControlComponent, REGISTROS_POR_PAGINA_KEY, MIN_PAGE_SIZE } from '../../../../shared/components/page-size-control/page-size-control';
import { TableScrollComponent } from '../../../../shared/components/table-scroll/table-scroll';

const AUTO_REFRESH_INTERVAL_MS = 20_000;

@Component({
  selector: 'app-document-uploads-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DocumentUploadStatusBadgeComponent, DocumentUploadModalComponent, PageSizeControlComponent, TableScrollComponent],
  templateUrl: './document-uploads-list.html',
})
export class DocumentUploadsListComponent implements OnInit, OnDestroy {
  private _service = inject(DocumentUploadsService);
  private _toast = inject(ToastService);
  private _router = inject(Router);
  private _configGeneralService = inject(ConfigGeneralService);

  items = signal<DocumentUploadItem[]>([]);
  documentTypes = signal<DocumentType[]>([]);
  isLoading = signal(false);

  currentPage = signal(1);
  pageSize = signal(MIN_PAGE_SIZE);
  totalItems = signal(0);
  totalPages = signal(0);

  private autoRefreshHandle?: ReturnType<typeof setInterval>;

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
    this._configGeneralService.getValue(REGISTROS_POR_PAGINA_KEY).subscribe({
      next: (value) => {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && parsed >= MIN_PAGE_SIZE) this.pageSize.set(parsed);
        this.loadItems();
      },
      error: () => this.loadItems(),
    });
    this.autoRefreshHandle = setInterval(() => this.loadItems(), AUTO_REFRESH_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.autoRefreshHandle) clearInterval(this.autoRefreshHandle);
  }

  refresh(): void {
    this.loadItems();
  }

  onFilterChange(): void {
    this.filterSubject.next();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize.set(newSize);
    this.currentPage.set(1);
    this.loadItems();
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

  // ── Paginación ────────────────────────────────────────────────────
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadItems();
  }
  nextPage(): void { this.goToPage(this.currentPage() + 1); }
  previousPage(): void { this.goToPage(this.currentPage() - 1); }

  get pageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }
    return range;
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

  onItemsCreated(): void {
    this.loadItems();
  }
}
