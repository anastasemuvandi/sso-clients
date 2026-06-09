// [GoR-SSO] ENTIRE FILE IS NEW — the SPA landing page the backend redirects to after
// [GoR-SSO] a successful SSO login (it was sent to:  <frontend>/sso/callback#token=<jwt>).
// [GoR-SSO] REUSABLE ACROSS APPS: copy this file + its route; the only app-specific
// [GoR-SSO] dependency is AuthService.loginWithSsoToken() and the post-login route.
import { Component, OnInit } from '@angular/core';                 // [GoR-SSO] OnInit: run logic when the view loads
import { CommonModule } from '@angular/common';                    // [GoR-SSO] for the *ngIf in the template
import { Router } from '@angular/router';                          // [GoR-SSO] to navigate onward after handling
import { AuthService } from '../services/auth.service';            // [GoR-SSO] stores the SSO session

@Component({                                                       // [GoR-SSO]
  selector: 'app-sso-callback',                                    // [GoR-SSO]
  standalone: true,                                                // [GoR-SSO] no NgModule needed
  imports: [CommonModule],                                         // [GoR-SSO]
  template: `
    <div class="sso-cb">                                          <!-- [GoR-SSO] full-screen "working" state -->
      <div class="sso-cb__card">                                  <!-- [GoR-SSO] -->
        <span class="sso-cb__spinner" *ngIf="!error"></span>      <!-- [GoR-SSO] spinner while we store the token -->
        <p *ngIf="!error">Signing you in…</p>                     <!-- [GoR-SSO] happy-path message -->
        <p *ngIf="error" class="sso-cb__err">{{ error }}</p>      <!-- [GoR-SSO] shown briefly on failure -->
      </div>
    </div>
  `,
  styles: [`
    .sso-cb { min-height: 100vh; display: flex; align-items: center; justify-content: center;
              background: linear-gradient(135deg, #1a3a5c 0%, #0d6efd 100%); }   /* [GoR-SSO] match login bg */
    .sso-cb__card { background: #fff; padding: 32px 40px; border-radius: 12px;
                    text-align: center; color: #374151; font-size: 14px; }        /* [GoR-SSO] */
    .sso-cb__spinner { display: inline-block; width: 28px; height: 28px; margin-bottom: 12px;
                       border: 3px solid #e5e7eb; border-top-color: #0d6efd;
                       border-radius: 50%; animation: sso-spin .7s linear infinite; } /* [GoR-SSO] */
    .sso-cb__err { color: #dc2626; }                                              /* [GoR-SSO] */
    @keyframes sso-spin { to { transform: rotate(360deg); } }                     /* [GoR-SSO] */
  `]
})
export class SsoCallbackComponent implements OnInit {              // [GoR-SSO]
  error = '';                                                      // [GoR-SSO] non-empty -> show error then bounce to login

  constructor(private auth: AuthService, private router: Router) {} // [GoR-SSO] inject session store + router

  ngOnInit(): void {                                               // [GoR-SSO] runs once when the component mounts
    // [GoR-SSO] The token arrives in the URL FRAGMENT (#…), which never reaches the
    // [GoR-SSO] server and isn't logged as a query param. Strip the leading '#'.
    const rawHash = window.location.hash.startsWith('#')           // [GoR-SSO]
      ? window.location.hash.substring(1)                          // [GoR-SSO] drop the '#'
      : window.location.hash;                                      // [GoR-SSO]
    const fragment = new URLSearchParams(rawHash);                 // [GoR-SSO] parse "token=…&…"
    const token = fragment.get('token');                          // [GoR-SSO] the RMIS JWT minted by the backend

    // [GoR-SSO] On failure the backend redirects to /login?sso_error=… (a QUERY param),
    // [GoR-SSO] so also inspect the query string here.
    const query = new URLSearchParams(window.location.search);     // [GoR-SSO]
    const ssoError = query.get('sso_error');                       // [GoR-SSO]

    if (ssoError || !token) {                                      // [GoR-SSO] no token => can't sign in
      this.error = 'Sign-in failed. Redirecting…';                 // [GoR-SSO] brief feedback
      this.router.navigate(['/login'], {                          // [GoR-SSO] send the user back to login
        queryParams: { sso_error: ssoError ?? 'missing_token' }    // [GoR-SSO] surface the reason
      });
      return;                                                      // [GoR-SSO] stop here
    }

    this.auth.loginWithSsoToken(token);                            // [GoR-SSO] persist the session (token + claims)

    // [GoR-SSO] Scrub the token from the address bar / history before moving on,
    // [GoR-SSO] so it isn't left in the browser history or copy-pasted by accident.
    history.replaceState(null, '', window.location.pathname);      // [GoR-SSO]

    this.router.navigate(['/dashboard']);                          // [GoR-SSO] APP-SPECIFIC: your post-login route
  }
}
