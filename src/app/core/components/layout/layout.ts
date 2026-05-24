import { Component, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TokenService } from '../../service/token.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './layout.html'
})
export class LayoutComponent {
  private _router = inject(Router);
  private _tokenService = inject(TokenService);

  isSidebarOpen = signal(true);
  currentRoute = signal('');

  constructor() {
    this.updateCurrentRoute();
  }

  toggleSidebar(): void {
    this.isSidebarOpen.set(!this.isSidebarOpen());
  }

  logout(): void {
    this._tokenService.removeToken();
    this._router.navigate(['/']);
  }

  isActiveRoute(route: string): boolean {
    return this._router.url.includes(route);
  }

  private updateCurrentRoute(): void {
    this._router.events.subscribe(() => {
      this.currentRoute.set(this._router.url);
    });
  }
}
