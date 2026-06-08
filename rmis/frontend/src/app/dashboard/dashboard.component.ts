import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, AuthResponse } from '../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-logo">RMIS</div>
        <nav class="sidebar-nav">
          <a class="nav-item active">
            <span class="icon">&#9632;</span> Dashboard
          </a>
          <a class="nav-item">
            <span class="icon">&#9679;</span> Records
          </a>
          <a class="nav-item">
            <span class="icon">&#9650;</span> Reports
          </a>
          <a class="nav-item">
            <span class="icon">&#9881;</span> Settings
          </a>
        </nav>
        <div class="sidebar-footer">
          <div class="user-info">
            <div class="avatar">{{ initials }}</div>
            <div class="user-details">
              <span class="user-name">{{ user?.fullName || user?.username }}</span>
              <span class="user-email">{{ user?.email }}</span>
            </div>
          </div>
          <button class="logout-btn" (click)="logout()">Sign Out</button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main">
        <header class="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back, <strong>{{ user?.fullName || user?.username }}</strong></p>
          </div>
          <div class="topbar-right">
            <span class="badge">RMIS v1.0</span>
          </div>
        </header>

        <section class="content">
          <!-- Stats -->
          <div class="stats-grid">
            <div class="stat-card blue">
              <div class="stat-icon">&#128196;</div>
              <div>
                <div class="stat-value">1,284</div>
                <div class="stat-label">Total Records</div>
              </div>
            </div>
            <div class="stat-card green">
              <div class="stat-icon">&#9989;</div>
              <div>
                <div class="stat-value">943</div>
                <div class="stat-label">Active Cases</div>
              </div>
            </div>
            <div class="stat-card orange">
              <div class="stat-icon">&#9203;</div>
              <div>
                <div class="stat-value">67</div>
                <div class="stat-label">Pending Review</div>
              </div>
            </div>
            <div class="stat-card purple">
              <div class="stat-icon">&#128202;</div>
              <div>
                <div class="stat-value">12</div>
                <div class="stat-label">Reports Generated</div>
              </div>
            </div>
          </div>

          <!-- Account Info -->
          <div class="info-card">
            <h3>Account Information</h3>
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label">Username</span>
                <span class="info-value">{{ user?.username }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Full Name</span>
                <span class="info-value">{{ user?.fullName || '—' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Email</span>
                <span class="info-value">{{ user?.email }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Auth Method</span>
                <span class="info-value tag">Local</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .layout { display: flex; min-height: 100vh; font-family: 'Segoe UI', sans-serif; }

    /* Sidebar */
    .sidebar {
      width: 240px; background: #1a3a5c; color: white;
      display: flex; flex-direction: column; padding: 24px 16px; flex-shrink: 0;
    }
    .sidebar-logo {
      font-size: 22px; font-weight: 800; letter-spacing: 3px;
      padding: 10px 16px; text-align: center;
      background: #0d6efd; border-radius: 8px; margin-bottom: 32px;
    }
    .sidebar-nav { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .nav-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      border-radius: 8px; font-size: 14px; color: rgba(255,255,255,.7);
      cursor: pointer; transition: all .2s; text-decoration: none;
    }
    .nav-item:hover, .nav-item.active { background: rgba(255,255,255,.12); color: white; }
    .icon { font-size: 12px; }
    .sidebar-footer { border-top: 1px solid rgba(255,255,255,.1); padding-top: 16px; }
    .user-info { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .avatar {
      width: 36px; height: 36px; border-radius: 50%; background: #0d6efd;
      display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0;
    }
    .user-details { display: flex; flex-direction: column; overflow: hidden; }
    .user-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-email { font-size: 11px; color: rgba(255,255,255,.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .logout-btn {
      width: 100%; padding: 8px; background: rgba(255,255,255,.1); color: white;
      border: 1px solid rgba(255,255,255,.2); border-radius: 8px; font-size: 13px;
      cursor: pointer; transition: background .2s;
    }
    .logout-btn:hover { background: rgba(220,38,38,.6); }

    /* Main */
    .main { flex: 1; display: flex; flex-direction: column; background: #f1f5f9; }
    .topbar {
      background: white; padding: 20px 32px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
    }
    .topbar h1 { font-size: 20px; color: #1a3a5c; }
    .topbar p  { font-size: 13px; color: #64748b; margin-top: 2px; }
    .badge {
      background: #e0f2fe; color: #0369a1;
      padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
    }
    .content { padding: 32px; }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 28px; }
    .stat-card {
      background: white; border-radius: 12px; padding: 20px;
      display: flex; align-items: center; gap: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    .stat-icon { font-size: 28px; }
    .stat-value { font-size: 24px; font-weight: 700; color: #1a3a5c; }
    .stat-label { font-size: 12px; color: #64748b; margin-top: 2px; }
    .blue .stat-icon  { color: #0d6efd; }
    .green .stat-icon { color: #16a34a; }
    .orange .stat-icon{ color: #ea580c; }
    .purple .stat-icon{ color: #7c3aed; }

    /* Info card */
    .info-card {
      background: white; border-radius: 12px; padding: 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    .info-card h3 { font-size: 16px; color: #1a3a5c; margin-bottom: 20px; }
    .info-grid { display: flex; flex-direction: column; gap: 14px; }
    .info-row { display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; }
    .info-row:last-child { border-bottom: none; padding-bottom: 0; }
    .info-label { width: 160px; font-size: 13px; color: #64748b; font-weight: 500; }
    .info-value { font-size: 14px; color: #1e293b; }
    .tag {
      background: #dcfce7; color: #15803d;
      padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;
    }

    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 600px) {
      .sidebar { display: none; }
      .stats-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  user: AuthResponse | null = null;
  initials = '';

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.getCurrentUser().subscribe(u => {
      this.user = u;
      if (u) {
        const name = u.fullName || u.username;
        this.initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
      }
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
