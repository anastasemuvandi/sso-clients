import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">IKIMINA MIS</div>
          <h2>Reset Password</h2>
          <p>Enter the code and your new password</p>
        </div>

        <form (ngSubmit)="submit()" #f="ngForm" class="auth-form">
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" [(ngModel)]="email" required placeholder="you@example.com" />
          </div>

          <div class="form-group">
            <label>Reset Code</label>
            <input type="text" name="code" [(ngModel)]="code" required inputmode="numeric"
                   maxlength="6" pattern="\\d{6}" placeholder="123456" />
          </div>

          <div class="form-group">
            <label>New Password</label>
            <div class="password-wrap">
              <input [type]="showPassword ? 'text' : 'password'" name="newPassword" [(ngModel)]="newPassword"
                     required minlength="6" placeholder="At least 6 characters" />
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
          <div *ngIf="successMessage" class="success-alert">{{ successMessage }}</div>

          <button type="submit" class="btn-primary" [disabled]="loading">
            <span *ngIf="loading" class="spinner"></span>
            {{ loading ? 'Updating...' : 'Reset Password' }}
          </button>
        </form>

        <div class="auth-footer">
          <a routerLink="/login">Back to sign in</a>
        </div>
      </div>
    </div>
  `
})
export class ResetPasswordComponent implements OnInit {
  email = '';
  code = '';
  newPassword = '';
  loading = false;
  errorMessage = '';
  successMessage = '';
  showPassword = false;

  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email') || '';
  }

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;
    this.auth.resetPassword(this.email, this.code, this.newPassword).subscribe({
      next: (res) => {
        this.successMessage = res.message;
        setTimeout(() => this.router.navigate(['/login']), 1200);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Could not reset password. Check your code.';
        this.loading = false;
      }
    });
  }
}
