import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Landing page for the SSO redirect: the backend bounces the browser here as
// /sso/callback#token=<jwt>. We read the token from the URL fragment, store the
// session, scrub the token from the URL, then route into the app.
@Component({
  selector: 'app-sso-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">IKIMINA MIS</div>
          <h2>Signing you in…</h2>
          <p>Completing single sign-on, please wait.</p>
        </div>
      </div>
    </div>
  `
})
export class SsoCallbackComponent implements OnInit {
  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    const frag = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = frag.get('token');
    const idToken = frag.get('id_token');                     // for RP-initiated logout
    if (!token) {
      this.router.navigate(['/login'], { queryParams: { sso_error: 'missing_token' } });
      return;
    }
    this.auth.loginWithSsoToken(token, idToken);              // store session (+ id_token)
    history.replaceState(null, '', window.location.pathname); // scrub token from URL/history
    this.router.navigate(['/dashboard']);                     // post-login route
  }
}
