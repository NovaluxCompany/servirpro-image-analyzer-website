import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { initFlowbite } from 'flowbite';
import { Login } from "./auth/login/login";
import { PruebaLogin } from "./prueba-login/prueba-login";
import { ToastContainerComponent } from './core/components/toast-container/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('ritmovivo-dashboard');

  ngOnInit(): void {
    initFlowbite();
  }

}
