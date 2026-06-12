import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="shell">
      <header class="topbar">
        <div class="brand">IKIMINA MIS</div>
        <nav class="nav">
          <a routerLink="/dashboard" class="nav-link">Dashboard</a>
          <button class="btn-logout" (click)="logout()">Logout</button>
        </nav>
      </header>

      <main class="content">
        <!-- Profile details -->
        <div class="card">
          <h2>My Profile</h2>
          <p class="sub">Update your account details.</p>

          <form (ngSubmit)="saveProfile()" #pf="ngForm">
            <div class="form-group">
              <label>Full Name</label>
              <input type="text" name="fullName" [(ngModel)]="fullName" required />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" name="email" [(ngModel)]="email" required />
            </div>
            <div class="form-group">
              <label>Phone Number</label>
              <input type="tel" name="phoneNumber" [(ngModel)]="phoneNumber" placeholder="+250 7.. ... ..." />
            </div>

            <div *ngIf="profileError" class="error-alert">{{ profileError }}</div>
            <div *ngIf="profileSuccess" class="success-alert">{{ profileSuccess }}</div>

            <button type="submit" class="btn-primary" [disabled]="savingProfile">
              <span *ngIf="savingProfile" class="spinner"></span>
              {{ savingProfile ? 'Saving...' : 'Save changes' }}
            </button>
          </form>
        </div>

        <!-- Change password -->
        <div class="card">
          <h2>Change Password</h2>
          <p class="sub">Use a strong password you don't reuse elsewhere.</p>

          <form (ngSubmit)="savePassword()" #cf="ngForm">
            <div class="form-group">
              <label>Current Password</label>
              <input type="password" name="currentPassword" [(ngModel)]="currentPassword" required />
            </div>
            <div class="form-group">
              <label>New Password</label>
              <input type="password" name="newPassword" [(ngModel)]="newPassword" required minlength="6"
                     placeholder="At least 6 characters" />
            </div>

            <div *ngIf="passwordError" class="error-alert">{{ passwordError }}</div>
            <div *ngIf="passwordSuccess" class="success-alert">{{ passwordSuccess }}</div>

            <button type="submit" class="btn-primary" [disabled]="savingPassword">
              <span *ngIf="savingPassword" class="spinner"></span>
              {{ savingPassword ? 'Updating...' : 'Update password' }}
            </button>
          </form>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .shell { min-height: 100vh; }
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      background: #14532d; color: #fff; padding: 14px 28px;
    }
    .brand { font-weight: 800; letter-spacing: 2px; }
    .nav { display: flex; align-items: center; gap: 16px; }
    .nav-link { color: #d1fae5; text-decoration: none; font-weight: 600; font-size: 14px; }
    .nav-link:hover { color: #fff; }
    .btn-logout {
      background: rgba(255,255,255,.12); color: #fff; border: 1px solid rgba(255,255,255,.3);
      padding: 7px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;
    }
    .btn-logout:hover { background: rgba(255,255,255,.22); }
    .content { max-width: 560px; margin: 40px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 24px; }
    .card { background: #fff; border-radius: 12px; padding: 28px 32px; box-shadow: 0 4px 20px rgba(0,0,0,.06); }
    .card h2 { color: #1a1a2e; font-size: 19px; margin-bottom: 4px; }
    .sub { color: #6b7280; margin-bottom: 22px; font-size: 14px; }
  `]
})
export class ProfileComponent implements OnInit {
  fullName = '';
  email = '';
  phoneNumber = '';
  savingProfile = false;
  profileError = '';
  profileSuccess = '';

  currentPassword = '';
  newPassword = '';
  savingPassword = false;
  passwordError = '';
  passwordSuccess = '';

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.auth.getProfile().subscribe({
      next: (p) => {
        this.fullName = p.fullName;
        this.email = p.email;
        this.phoneNumber = p.phoneNumber;
      },
      error: () => this.auth.logout()
    });
  }

  saveProfile(): void {
    this.profileError = '';
    this.profileSuccess = '';
    this.savingProfile = true;
    this.auth.updateProfile(this.email, this.fullName, this.phoneNumber).subscribe({
      next: () => {
        this.profileSuccess = 'Profile updated.';
        this.savingProfile = false;
      },
      error: (err) => {
        this.profileError = err.error?.message || 'Could not update profile.';
        this.savingProfile = false;
      }
    });
  }

  savePassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';
    this.savingPassword = true;
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: (res) => {
        this.passwordSuccess = res.message;
        this.currentPassword = '';
        this.newPassword = '';
        this.savingPassword = false;
      },
      error: (err) => {
        this.passwordError = err.error?.message || 'Could not change password.';
        this.savingPassword = false;
      }
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
