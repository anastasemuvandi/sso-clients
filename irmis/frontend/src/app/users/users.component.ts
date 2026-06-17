import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserProfile } from '../services/auth.service';

// ADMIN-only view: the full list of accounts. The route is guarded client-side
// (adminGuard) and the API is guarded server-side (@PreAuthorize hasRole ADMIN).
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="shell">
      <header class="topbar">
        <div class="brand">IRMIS</div>
        <nav class="nav">
          <a class="btn-link" routerLink="/dashboard">Dashboard</a>
          <button class="btn-logout" (click)="logout()">Logout</button>
        </nav>
      </header>

      <main class="content">
        <div class="card">
          <h1>Users</h1>
          <p class="sub">All accounts registered on the IRMIS portal.</p>

          <div *ngIf="error" class="error-alert">{{ error }}</div>

          <div *ngIf="!error" class="table-wrap">
            <table class="users">
              <thead>
                <tr><th>Email</th><th>Full name</th><th>Phone</th><th>Role</th><th>Member since</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let u of users">
                  <td>{{ u.email }}</td>
                  <td>{{ u.fullName || '—' }}</td>
                  <td>{{ u.phoneNumber || '—' }}</td>
                  <td><span class="badge" [class.admin]="u.role === 'ADMIN'">{{ u.role }}</span></td>
                  <td>{{ u.createdAt | date:'mediumDate' }}</td>
                </tr>
                <tr *ngIf="users && users.length === 0">
                  <td colspan="5" class="empty">No users found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .shell { min-height: 100vh; }
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      background: #0f3d6e; color: #fff; padding: 14px 28px;
    }
    .brand { font-weight: 800; letter-spacing: 2px; }
    .nav { display: flex; align-items: center; gap: 16px; }
    .btn-link { color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; opacity: .9; }
    .btn-link:hover { opacity: 1; text-decoration: underline; }
    .btn-logout {
      background: rgba(255,255,255,.12); color: #fff; border: 1px solid rgba(255,255,255,.3);
      padding: 7px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;
    }
    .btn-logout:hover { background: rgba(255,255,255,.22); }
    .content { max-width: 960px; margin: 40px auto; padding: 0 20px; }
    .card { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,.06); }
    .card h1 { color: #1a1a2e; font-size: 24px; margin-bottom: 6px; }
    .sub { color: #6b7280; margin-bottom: 24px; }
    .error-alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 12px 14px; border-radius: 8px; }
    .table-wrap { overflow-x: auto; }
    table.users { width: 100%; border-collapse: collapse; font-size: 14px; }
    table.users th, table.users td { text-align: left; padding: 12px 14px; border-bottom: 1px solid #eef2f7; }
    table.users th { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: #9ca3af; }
    table.users td { color: #1f2937; }
    .empty { text-align: center; color: #9ca3af; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700;
             background: #eef2f7; color: #475569; }
    .badge.admin { background: #0f3d6e; color: #fff; }
  `]
})
export class UsersComponent implements OnInit {
  users: UserProfile[] = [];
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.auth.listUsers().subscribe({
      next: (list) => this.users = list,
      error: (err) => {
        if (err.status === 401) { this.auth.logout(); return; }   // token gone/expired
        if (err.status === 403) { this.router.navigate(['/dashboard']); return; } // not an admin
        this.error = 'Could not load users. Please try again.';
      }
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
