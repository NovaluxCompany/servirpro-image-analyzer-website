import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { initFlowbite } from 'flowbite';
import { Login } from "./auth/login/login";
import { PruebaLogin } from "./prueba-login/prueba-login";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('ritmovivo-dashboard');

  ngOnInit(): void {
    initFlowbite();
  }

}
