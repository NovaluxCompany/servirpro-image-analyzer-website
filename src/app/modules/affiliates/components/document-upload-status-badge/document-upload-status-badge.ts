import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentUploadStatus } from '../../interfaces/document-upload.interface';

@Component({
  selector: 'app-document-upload-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (status() === 'QUEUED') {
      <span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
        <span class="w-2 h-2 bg-gray-400 rounded-full"></span>
        En espera
      </span>
    } @else if (status() === 'SENDING') {
      <span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">
        <span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
        Enviando
      </span>
    } @else if (status() === 'ERROR') {
      <span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-800 bg-red-100 rounded-full">
        <span class="w-2 h-2 bg-red-500 rounded-full"></span>
        Error
      </span>
    } @else if (status() === 'SUCCESS') {
      <span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
        <span class="w-2 h-2 bg-green-500 rounded-full"></span>
        Completado
      </span>
    }
  `,
})
export class DocumentUploadStatusBadgeComponent {
  status = input.required<DocumentUploadStatus>();
}
