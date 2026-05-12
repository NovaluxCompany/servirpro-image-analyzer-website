import { Component, signal } from '@angular/core';
import { MenuForModal } from '../components/menu-for-modal/menu-for-modal';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [MenuForModal],
  templateUrl: './menu-list.html',
  styles: ``,
})
export class Menu {
    showFormModal = signal(false);
}
