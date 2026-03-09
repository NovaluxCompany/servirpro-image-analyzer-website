import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ImagePreview {
  file: File;
  url: string;
}

@Component({
  selector: 'app-image-uploader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-uploader.html'
})
export class ImageUploaderComponent {
  imagesChanged = output<File[]>();
  
  images = signal<ImagePreview[]>([]);
  isDragging = signal(false);
  errorMessage = signal<string | null>(null);

  private readonly MAX_FILES = 10;
  private readonly MAX_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
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

    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(Array.from(files));
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
  }

  private handleFiles(files: File[]): void {
    this.errorMessage.set(null);

    // Validar cantidad total
    const currentCount = this.images().length;
    const newCount = currentCount + files.length;
    
    if (newCount > this.MAX_FILES) {
      this.errorMessage.set(`Máximo ${this.MAX_FILES} imágenes permitidas. Actualmente tienes ${currentCount}.`);
      return;
    }

    // Validar cada archivo
    for (const file of files) {
      if (!this.ALLOWED_TYPES.includes(file.type)) {
        this.errorMessage.set(`Tipo de archivo no permitido: ${file.name}. Solo se permiten JPG y PNG.`);
        return;
      }

      if (file.size > this.MAX_SIZE) {
        this.errorMessage.set(`Archivo muy grande: ${file.name}. Tamaño máximo 5MB.`);
        return;
      }
    }

    // Agregar imágenes con preview
    const newPreviews: ImagePreview[] = [];
    let processedCount = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push({
          file,
          url: e.target?.result as string
        });

        processedCount++;
        if (processedCount === files.length) {
          this.images.update(current => [...current, ...newPreviews]);
          this.emitFiles();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  removeImage(index: number): void {
    this.images.update(current => current.filter((_, i) => i !== index));
    this.emitFiles();
    this.errorMessage.set(null);
  }

  private emitFiles(): void {
    const files = this.images().map(img => img.file);
    this.imagesChanged.emit(files);
  }

  getFileCount(): number {
    return this.images().length;
  }
}
