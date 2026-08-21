import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenusService } from '../services/menus.service';
import { Menu } from '../interfaces/menu.interface';
import { MenuForModal } from '../components/menu-for-modal/menu-for-modal';
import { ToastService } from '../../../core/service/toast.service';
import { ConfigGeneralService } from '../../../core/service/config-general.service';
import { PageSizeControlComponent, REGISTROS_POR_PAGINA_KEY, MIN_PAGE_SIZE } from '../../../shared/components/page-size-control/page-size-control';
import { TableScrollComponent } from '../../../shared/components/table-scroll/table-scroll';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, MenuForModal, PageSizeControlComponent, TableScrollComponent],
  templateUrl: './menu-list.html',
})
export class MenuComponent implements OnInit {
  private menusService = inject(MenusService);
  private toastService = inject(ToastService);
  private configGeneralService = inject(ConfigGeneralService);
  protected Math = Math;

  menus = signal<Menu[]>([]);
  totalItems = signal(0);
  currentPage = signal(1);
  pageSize = signal(MIN_PAGE_SIZE);
  showFormModal = signal(false);
  selectedMenu = signal<Menu | null>(null);
  isLoading = signal(false);
  menuToDelete = signal<Menu | null>(null);

  ngOnInit() {
    this.configGeneralService.getValue(REGISTROS_POR_PAGINA_KEY).subscribe({
      next: (value) => {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && parsed >= MIN_PAGE_SIZE) this.pageSize.set(parsed);
        this.loadMenus();
      },
      error: () => this.loadMenus(),
    });
  }

  onPageSizeChange(newSize: number) {
    this.pageSize.set(newSize);
    this.currentPage.set(1);
    this.loadMenus();
  }

  loadMenus() {
    this.isLoading.set(true);
    this.menusService.findAll(this.currentPage(), this.pageSize()).subscribe({
      next: (response) => {
        this.menus.set(response.items);
        this.totalItems.set(response.meta.totalItems);
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.showError('Error al cargar los menús. Intenta de nuevo.');
        this.isLoading.set(false);
      }
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
    this.toastService.showSuccess('Menú guardado correctamente.');
    this.loadMenus();
  }

  confirmDelete(menu: Menu) {
    this.menuToDelete.set(menu);
  }

  cancelDelete() {
    this.menuToDelete.set(null);
  }

  deleteMenu() {
    const menu = this.menuToDelete();
    if (!menu?.id) return;
    this.menusService.remove(menu.id).subscribe({
      next: () => {
        this.toastService.showSuccess('Menú eliminado correctamente.');
        this.menuToDelete.set(null);
        this.loadMenus();
      },
      error: () => {
        this.toastService.showError('No se pudo eliminar el menú. Intenta de nuevo.');
        this.menuToDelete.set(null);
      }
    });
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems() / this.pageSize());
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
}
