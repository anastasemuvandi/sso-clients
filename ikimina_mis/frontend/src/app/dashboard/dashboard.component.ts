import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserProfile } from '../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="shell">
      <header class="topbar">
        <div class="brand">IKIMINA MIS</div>
        <nav class="nav">
          <a routerLink="/profile" class="nav-link">Profile</a>
          <button class="btn-logout" (click)="logout()">Logout</button>
        </nav>
      </header>

      <main class="content">
        <div class="card">
          <h1>Welcome{{ profile?.fullName ? ', ' + profile?.fullName : '' }}!</h1>
          <p class="sub">You are signed in to the Ikimina Management Information System.</p>

          <div *ngIf="profile" class="info-grid">
            <div class="info-item"><span class="k">Email</span><span class="v">{{ profile.email }}</span></div>
            <div class="info-item"><span class="k">Full name</span><span class="v">{{ profile.fullName || '—' }}</span></div>
            <div class="info-item"><span class="k">Phone</span><span class="v">{{ profile.phoneNumber || '—' }}</span></div>
            <div class="info-item"><span class="k">Member since</span><span class="v">{{ profile.createdAt | date:'mediumDate' }}</span></div>
          </div>

          <div class="actions">
            <a routerLink="/profile" class="btn-primary" style="display:inline-flex;width:auto;padding:10px 20px;text-decoration:none">Edit profile</a>
          </div>
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
    .content { max-width: 760px; margin: 40px auto; padding: 0 20px; }
    .card { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,.06); }
    .card h1 { color: #1a1a2e; font-size: 24px; margin-bottom: 6px; }
    .sub { color: #6b7280; margin-bottom: 24px; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .info-item { display: flex; flex-direction: column; gap: 4px; background: #f8fafc; border-radius: 10px; padding: 14px 16px; }
    .info-item .k { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: #9ca3af; }
    .info-item .v { font-size: 15px; color: #1f2937; font-weight: 600; word-break: break-all; }
    .actions { margin-top: 28px; }
  `]
})
export class DashboardComponent implements OnInit {
  profile: UserProfile | null = null;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.auth.getProfile().subscribe({
      next: (p) => this.profile = p,
      error: () => this.auth.logout()   // token rejected — bounce to login
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
