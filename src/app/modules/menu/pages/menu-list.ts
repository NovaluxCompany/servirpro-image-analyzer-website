import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenusService } from '../services/menus.service';
import { Menu } from '../interfaces/menu.interface';
import { MenuForModal } from '../components/menu-for-modal/menu-for-modal';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, MenuForModal],
  templateUrl: './menu-list.html',
  styles: ``,
})
export class MenuComponent implements OnInit {
  private menusService = inject(MenusService);
  protected Math = Math;

  menus = signal<Menu[]>([]);
  totalItems = signal(0);
  currentPage = signal(1);
  pageSize = signal(10);
  showFormModal = signal(false);
  selectedMenu = signal<Menu | null>(null);

  ngOnInit() {
    this.loadMenus();
  }

  loadMenus() {
    this.menusService.findAll(this.currentPage(), this.pageSize()).subscribe({
      next: (response) => {
        this.menus.set(response.items);
        this.totalItems.set(response.meta.totalItems);
      },
      error: (err) => console.error('Error loading menus', err)
    });
  }

  openCreateModal() {
    this.selectedMenu.set(null);
    this.showFormModal.set(true);
  }

  openEditModal(menu: Menu) {
    this.selectedMenu.set(menu);
    this.showFormModal.set(true);
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.loadMenus();
  }

  onSaved() {
    this.showFormModal.set(false);
    this.loadMenus();
  }

  deleteMenu(id: number) {
    if (confirm('¿Está seguro de eliminar este menú?')) {
      this.menusService.remove(id).subscribe({
        next: () => this.loadMenus(),
        error: (err) => console.error('Error deleting menu', err)
      });
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems() / this.pageSize());
  }

  get pages(): number[] {
    const total = this.totalPages;
    return Array.from({ length: total }, (_, i) => i + 1);
  }
}
 