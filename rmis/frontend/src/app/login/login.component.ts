import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">RMIS</div>
          <h2>{{ isRegister ? 'Create Account' : 'Welcome Back' }}</h2>
          <p>{{ isRegister ? 'Register to access RMIS' : 'Sign in to your account' }}</p>
        </div>

        <form (ngSubmit)="submit()" #f="ngForm" class="auth-form">
          <div *ngIf="isRegister" class="form-group">
            <label>Full Name</label>
            <input type="text" name="fullName" [(ngModel)]="fullName" placeholder="John Doe" />
          </div>

          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" [(ngModel)]="username" required placeholder="Enter username" />
          </div>

          <div *ngIf="isRegister" class="form-group">
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
            {{ loading ? 'Please wait...' : (isRegister ? 'Register' : 'Sign In') }}
          </button>
        </form>

        <div class="divider"><span>or</span></div>

        <button type="button" class="btn-sso" (click)="loginWithSso()">
          <span class="sso-mark">GoR</span>
          Continue with Government SSO
        </button>

        <div class="auth-footer">
          <span *ngIf="!isRegister">Don't have an account?
            <a (click)="toggleMode()">Register</a>
          </span>
          <span *ngIf="isRegister">Already have an account?
            <a (click)="toggleMode()">Sign In</a>
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a3a5c 0%, #0d6efd 100%);
    }
    .auth-card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .auth-header { text-align: center; margin-bottom: 32px; }
    .logo {
      display: inline-block;
      background: #0d6efd;
      color: white;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 3px;
      padding: 10px 24px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .auth-header h2 { margin: 0 0 6px; color: #1a1a2e; font-size: 22px; }
    .auth-header p  { margin: 0; color: #6b7280; font-size: 14px; }
    .form-group { margin-bottom: 18px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .form-group input {
      width: 100%; padding: 10px 14px; border: 1.5px solid #d1d5db;
      border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box;
      transition: border-color .2s;
    }
    .form-group input:focus { border-color: #0d6efd; }
    .password-wrap { position: relative; }
    .password-wrap input { padding-right: 44px; }
    .toggle-pw {
      position: absolute; top: 0; right: 0; height: 100%; width: 44px;
      display: flex; align-items: center; justify-content: center;
      background: none; border: none; padding: 0; margin: 0;
      color: #9ca3af; cursor: pointer;
    }
    .toggle-pw:hover { color: #6b7280; }
    .toggle-pw:focus-visible { outline: 2px solid #0d6efd; outline-offset: -2px; border-radius: 6px; }
    .btn-primary {
      width: 100%; padding: 12px; background: #0d6efd; color: white;
      border: none; border-radius: 8px; font-size: 15px; font-weight: 600;
      cursor: pointer; margin-top: 8px; display: flex; align-items: center;
      justify-content: center; gap: 8px; transition: background .2s;
    }
    .btn-primary:hover:not(:disabled) { background: #0b5ed7; }
    .btn-primary:disabled { opacity: .7; cursor: not-allowed; }
    .divider {
      display: flex; align-items: center; text-align: center;
      color: #9ca3af; font-size: 12px; margin: 20px 0;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; border-bottom: 1px solid #e5e7eb;
    }
    .divider span { padding: 0 12px; text-transform: uppercase; letter-spacing: 1px; }
    .btn-sso {
      width: 100%; padding: 12px; background: #fff; color: #1a3a5c;
      border: 1.5px solid #1a3a5c; border-radius: 8px; font-size: 15px;
      font-weight: 600; cursor: pointer; display: flex; align-items: center;
      justify-content: center; gap: 10px; transition: background .2s, color .2s;
    }
    .btn-sso:hover { background: #1a3a5c; color: #fff; }
    .sso-mark {
      background: #1a3a5c; color: #fff; font-size: 11px; font-weight: 800;
      letter-spacing: 1px; padding: 3px 7px; border-radius: 5px;
    }
    .btn-sso:hover .sso-mark { background: #fff; color: #1a3a5c; }
    .error-alert {
      background: #fee2e2; color: #dc2626; border-radius: 8px;
      padding: 10px 14px; font-size: 13px; margin-bottom: 12px;
    }
    .spinner {
      width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.3);
      border-top-color: white; border-radius: 50%; animation: spin .6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .auth-footer { text-align: center; margin-top: 24px; font-size: 14px; color: #6b7280; }
    .auth-footer a { color: #0d6efd; cursor: pointer; font-weight: 600; }
    .auth-footer a:hover { text-decoration: underline; }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  email = '';
  fullName = '';
  isRegister = false;
  loading = false;
  errorMessage = '';
  showPassword = false;

  constructor(private auth: AuthService, private router: Router) {}

  submit(): void {
    this.errorMessage = '';
    this.loading = true;
    const obs = this.isRegister
      ? this.auth.register(this.username, this.email, this.password, this.fullName)
      : this.auth.login(this.username, this.password);

    obs.subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.errorMessage = err.error?.message || 'Invalid credentials. Please try again.';
        this.loading = false;
      }
    });
  }

  toggleMode(): void {
    this.isRegister = !this.isRegister;
    this.errorMessage = '';
  }

  loginWithSso(): void {
    // [GoR-SSO] Full-page navigation (not XHR): the browser must physically travel to
    // [GoR-SSO] the SSO login and back. Hitting Spring's /oauth2/authorization/gor makes
    // [GoR-SSO] Spring Security build the PKCE+state authorize URL and 302 to the platform.
    window.location.href = environment.ssoLoginUrl;
  }
}
