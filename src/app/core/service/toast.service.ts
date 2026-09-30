import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

const DEFAULT_DURATION_MS = 5000;

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  toasts = signal<Toast[]>([]);
  private nextId = 0;

  showSuccess(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.addToast(message, 'success', durationMs);
  }

  showError(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.addToast(message, 'error', durationMs);
  }

  showInfo(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.addToast(message, 'info', durationMs);
  }

  showWarning(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.addToast(message, 'warning', durationMs);
  }

  private addToast(message: string, type: Toast['type'], durationMs: number): void {
    const id = this.nextId++;
    const toast: Toast = { id, message, type };

    this.toasts.update(toasts => [...toasts, toast]);

    setTimeout(() => {
      this.removeToast(id);
    }, durationMs);
  }

  removeToast(id: number): void {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }
}
