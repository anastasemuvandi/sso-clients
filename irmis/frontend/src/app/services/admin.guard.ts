import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Client-side convenience only — the backend still enforces ADMIN on /api/user/all.
// Sends non-admins (and not-yet-loaded sessions) back to their dashboard.
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn() && auth.isAdmin()) return true;
  router.navigate(['/dashboard']);
  return false;
};
