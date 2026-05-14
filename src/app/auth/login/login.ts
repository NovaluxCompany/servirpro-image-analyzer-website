import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/service/auth.service';
import { Router } from '@angular/router';
import { TokenService } from '../../core/service/token.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html'
})

export class Login {
  showError: boolean = false;
  messageError: string = '';
  isLoading: boolean = false;
  showPassword: boolean = false;

  private _tokenService = inject(TokenService);
  private _authService = inject(AuthService);
  private _router = inject(Router);
  private _cdr = inject(ChangeDetectorRef);
  private _fb = inject(FormBuilder);

  form = this._fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  login() {
    this.resetState();

    if (!this.isFormValid()) {
      return;
    }

    this.executeAuthentication();
  }

  private resetState() {
    this._tokenService.removeToken();
    this.showError = false;
    this.messageError = '';
  }

  private isFormValid(): boolean {
    if (this.form.invalid) {
      this.showError = true;

      const email = this.form.get('email');
      const password = this.form.get('password');

      if (email?.hasError('required') || password?.hasError('required')) {
        this.messageError = "Todos los campos son requeridos";
      } else if (email?.hasError('email')) {
        this.messageError = "Formato incorrecto del correo electrónico.";
      } else if (password?.hasError('minlength')) {
        this.messageError = "La contraseña debe tener 6 o más caracteres.";
      }
      return false;
    }
    return true;
  }

  private executeAuthentication() {
    this.isLoading = true;
    const { email, password } = this.form.getRawValue();

    this._authService.loginDB(email!, password!).subscribe({
      next: () => {
        this.isLoading = false;
        this._router.navigate(['/transacciones']);
      },
      error: () => {
        this.isLoading = false;
        this.showError = true;
        this.messageError = "Correo electrónico y/o contraseña incorrectos";
        this._cdr.detectChanges();
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}
