import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu-for-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-for-modal.html',
  styles: ``,
})
export class MenuForModal {
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }
}
