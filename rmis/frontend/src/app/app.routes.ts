import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent)
  },
  // [GoR-SSO] Landing route the backend redirects to after SSO login (#token=…).
  // [GoR-SSO] Public (no authGuard): the user isn't "logged in" until this runs.
  {
    path: 'sso/callback',
    loadComponent: () => import('./sso-callback/sso-callback.component').then(m => m.SsoCallbackComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: 'dashboard' }
];
