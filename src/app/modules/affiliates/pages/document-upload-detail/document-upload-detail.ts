import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { DocumentUploadsService } from '../../services/document-uploads.service';
import { DocumentUploadItem } from '../../interfaces/document-upload.interface';
import { DocumentUploadStatusBadgeComponent } from '../../components/document-upload-status-badge/document-upload-status-badge';
import { ToastService } from '../../../../core/service/toast.service';

const ACTIVE_STATUSES = ['QUEUED', 'SENDING'];

@Component({
  selector: 'app-document-upload-detail',
  standalone: true,
  imports: [CommonModule, DocumentUploadStatusBadgeComponent],
  templateUrl: './document-upload-detail.html',
})
export class DocumentUploadDetailComponent implements OnInit, OnDestroy {
  private _service = inject(DocumentUploadsService);
  private _route = inject(ActivatedRoute);
  private _router = inject(Router);
  private _toast = inject(ToastService);

  item = signal<DocumentUploadItem | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  showErrorDetailModal = signal(false);
  isMarkingManual = signal(false);

  private pollingSubscription?: Subscription;
  private id: number | null = null;

  ngOnInit(): void {
    const idParam = this._route.snapshot.paramMap.get('id');
    this.id = idParam ? Number(idParam) : null;
    if (this.id) {
      this.load(this.id);
    } else {
      this.errorMessage.set('Registro no válido');
      this.isLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private load(id: number): void {
    this.isLoading.set(true);
    this._service.getById(id).subscribe({
      next: (data) => {
        this.item.set(data);
        this.isLoading.set(false);
        if (ACTIVE_STATUSES.includes(data.status)) {
          this.startPolling(id);
        } else {
          this.stopPolling();
        }
      },
      error: (err) => {
        this.errorMessage.set(err.message ?? 'No se pudo cargar el registro.');
        this.isLoading.set(false);
      },
    });
  }

  private startPolling(id: number): void {
    this.stopPolling();
    this.pollingSubscription = interval(5000)
      .pipe(
        switchMap(() => this._service.getById(id)),
        takeWhile((item) => ACTIVE_STATUSES.includes(item.status), true),
      )
      .subscribe({
        next: (data) => {
          this.item.set(data);
          if (!ACTIVE_STATUSES.includes(data.status)) this.stopPolling();
        },
        error: () => this.stopPolling(),
      });
  }

  private stopPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = undefined;
  }

  markManualSend(): void {
    if (!this.id) return;
    this.isMarkingManual.set(true);
    this._service.markManualSend(this.id).subscribe({
      next: (data) => {
        this.item.set(data);
        this.isMarkingManual.set(false);
        this.showErrorDetailModal.set(false);
        this._toast.showSuccess('Envío marcado como manual. El registro quedó completado.');
      },
      error: (err) => {
        this.isMarkingManual.set(false);
        this._toast.showError(err.message ?? 'No se pudo marcar el envío manual.');
      },
    });
  }

  goBack(): void {
    this._router.navigate(['/afiliados/cargue-documentos']);
  }
}
