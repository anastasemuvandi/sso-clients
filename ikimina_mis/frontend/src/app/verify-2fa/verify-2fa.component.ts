import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-verify-2fa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">IKIMINA MIS</div>
          <h2>Two-Factor Verification</h2>
          <p>Enter the 6-digit code we emailed you</p>
        </div>

        <p class="hint" *ngIf="email">Code sent to <strong>{{ email }}</strong></p>

        <form (ngSubmit)="submit()" #f="ngForm" class="auth-form">
          <div class="form-group">
            <label>Verification Code</label>
            <input type="text" name="code" [(ngModel)]="code" required inputmode="numeric"
                   maxlength="6" pattern="\\d{6}" placeholder="123456" autocomplete="one-time-code" />
          </div>

          <div *ngIf="errorMessage" class="error-alert">{{ errorMessage }}</div>

          <button type="submit" class="btn-primary" [disabled]="loading">
            <span *ngIf="loading" class="spinner"></span>
            {{ loading ? 'Verifying...' : 'Verify & Sign In' }}
          </button>
        </form>

        <div class="auth-footer">
          Didn't get a code? <a routerLink="/login">Back to sign in</a>
        </div>
      </div>
    </div>
  `
})
export class VerifyTwoFactorComponent implements OnInit {
  email = '';
  code = '';
  loading = false;
  errorMessage = '';

  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email') || '';
    // Reached directly without an email in hand — send the user back to login.
    if (!this.email) {
      this.router.navigate(['/login']);
    }
  }

  submit(): void {
    this.errorMessage = '';
    this.loading = true;
    this.auth.verifyTwoFactor(this.email, this.code).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.errorMessage = err.error?.message || 'Invalid or expired code.';
        this.loading = false;
      }
    });
  }
}
