import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import {environment} from "../../environments/environment";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">IKIMINA MIS</div>
          <h2>Welcome Back</h2>
          <p>Sign in to your account</p>
        </div>

        <form (ngSubmit)="submit()" #f="ngForm" class="auth-form">
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" [(ngModel)]="email" required placeholder="you@example.com" />
          </div>

          <div class="form-group">
            <label>Password</label>
            <div class="password-wrap">
              <input [type]="showPassword ? 'text' : 'password'" name="password" [(ngModel)]="password" required placeholder="••••••••" />
              <button type="button" class="toggle-pw" (click)="showPassword = !showPassword"
                      [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
                      [attr.aria-pressed]="showPassword">
                <svg *ngIf="!showPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg *ngIf="showPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>

          <div *ngIf="errorMessage" class="error-alert">{{ errorMessage }}</div>

          <button type="submit" class="btn-primary" [disabled]="loading">
            <span *ngIf="loading" class="spinner"></span>
            {{ loading ? 'Please wait...' : 'Sign In' }}
          </button>
        </form>

        <div class="auth-divider"><span>or</span></div>

        <!-- Full-page navigation to the IdP; not a form submit. -->
        <button type="button" class="btn-sso" (click)="loginWithSso()">
          Sign in with GoR SSO
        </button>

        <div class="auth-footer">
          <a routerLink="/forgot-password">Forgot password?</a>
        </div>
        <div class="auth-footer">
          Don't have an account? <a routerLink="/register">Register</a>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  errorMessage = '';
  showPassword = false;

  constructor(private auth: AuthService, private router: Router) {}
    loginWithSso(): void {
        // FULL-PAGE navigation (not XHR) — the browser must travel to the IdP and back.
        window.location.href = environment.ssoLoginUrl;
    }
  submit(): void {
    this.errorMessage = '';
    this.loading = true;
    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        // 2FA is always required: head to the code-entry screen, carrying the email.
        this.router.navigate(['/verify-2fa'], { queryParams: { email: res.email } });
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Invalid email or password.';
        this.loading = false;
      }
    });
  }
}
