import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">IKIMINA MIS</div>
          <h2>Forgot Password</h2>
          <p>We'll email you a code to reset it</p>
        </div>

        <form (ngSubmit)="submit()" #f="ngForm" class="auth-form">
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" [(ngModel)]="email" required placeholder="you@example.com" />
          </div>

          <div *ngIf="errorMessage" class="error-alert">{{ errorMessage }}</div>
          <div *ngIf="successMessage" class="success-alert">{{ successMessage }}</div>

          <button type="submit" class="btn-primary" [disabled]="loading">
            <span *ngIf="loading" class="spinner"></span>
            {{ loading ? 'Sending...' : 'Send Reset Code' }}
          </button>
        </form>

        <div class="auth-footer">
          Remembered it? <a routerLink="/login">Back to sign in</a>
        </div>
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private auth: AuthService, private router: Router) {}

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;
    this.auth.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.successMessage = res.message;
        // Move on to code entry, carrying the email so the user doesn't retype it.
        setTimeout(() => this.router.navigate(['/reset-password'], { queryParams: { email: this.email } }), 1200);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Something went wrong. Please try again.';
        this.loading = false;
      }
    });
  }
}
