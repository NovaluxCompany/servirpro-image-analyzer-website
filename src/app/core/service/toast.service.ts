import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  toasts = signal<Toast[]>([]);
  private nextId = 0;

  showSuccess(message: string, durationMs = 5000): void {
    this.addToast(message, 'success', durationMs);
  }

  showError(message: string, durationMs = 5000): void {
    this.addToast(message, 'error', durationMs);
  }

  showInfo(message: string, durationMs = 5000): void {
    this.addToast(message, 'info', durationMs);
  }

  private addToast(message: string, type: 'success' | 'error' | 'info', durationMs: number): void {
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
