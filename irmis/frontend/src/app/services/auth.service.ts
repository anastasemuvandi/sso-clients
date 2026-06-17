import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthResponse {
  token: string;
  email: string;
  fullName: string;
  role?: string;            // 'ADMIN' | 'USER' — drives role-based UI
}

export interface MessageResponse {
  message: string;
}

export interface UserProfile {
  email: string;
  fullName: string;
  phoneNumber: string;
  role: string;             // 'ADMIN' | 'USER'
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'irmis_token';
  private readonly USER_KEY = 'irmis_user';
  private readonly ID_TOKEN_KEY = 'irmis_id_token';   // SSO id_token, for RP-initiated logout

  private currentUser$ = new BehaviorSubject<AuthResponse | null>(this.loadUser());

  constructor(private http: HttpClient, private router: Router) {}

  // ── Auth flows ────────────────────────────────────────────────────────────

  register(email: string, password: string, fullName: string, phoneNumber: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${environment.apiUrl}/auth/register`,
      { email, password, fullName, phoneNumber });
  }

  /** Verify the password and receive the JWT in one step. */
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  /** SSO: store a session from a JWT the backend minted. Pass the OIDC id_token
   *  too (from the callback fragment) so logout() can do RP-initiated sign-out. */
  loginWithSsoToken(token: string, idToken?: string | null): void {
    const c = this.decodeJwt(token);                          // payload, for display only
    this.saveSession({
      token,
      email: c?.email ?? c?.sub ?? '',
      fullName: c?.name ?? c?.fullName ?? ''
    });
    if (idToken) {
      localStorage.setItem(this.ID_TOKEN_KEY, idToken);
    }
  }

  // ── Profile (authenticated) ─────────────────────────────────────────────────

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${environment.apiUrl}/user/me`).pipe(
      // Persist the role onto the stored session so isAdmin() works on the next
      // navigation — covers SSO sign-ins, where the role isn't known at login.
      tap(p => this.mergeRole(p.role))
    );
  }

  /** ADMIN only — the backend returns 403 for non-admins. */
  listUsers(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${environment.apiUrl}/user/all`);
  }

  isAdmin(): boolean {
    return this.currentUser$.value?.role === 'ADMIN';
  }

  private mergeRole(role: string): void {
    const current = this.currentUser$.value;
    if (current && current.role !== role) {
      const updated = { ...current, role };
      localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
      this.currentUser$.next(updated);
    }
  }

  // ── Session helpers ──────────────────────────────────────────────────────────

  logout(): void {
    const idToken = localStorage.getItem(this.ID_TOKEN_KEY);
    // Clear the local session first (token, user, id_token).
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.ID_TOKEN_KEY);
    this.currentUser$.next(null);

    // SSO login: end the Keycloak session too (RP-initiated logout), else the
    // user is silently signed back in on the next visit.
    if (idToken) {
      window.location.href = `${environment.ssoLogoutUrl}`             // http://localhost:8000/oauth2/logout
        + `?post_logout_redirect_uri=${encodeURIComponent(environment.postLogoutRedirectUri)}`
        + `&client_id=${encodeURIComponent(environment.ssoClientId)}`  // REQUIRED by the wrapper
        + `&id_token_hint=${encodeURIComponent(idToken)}`;             // full-page nav
      return;
    }
    this.router.navigate(['/login']);   // local login: nothing to end remotely
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): Observable<AuthResponse | null> {
    return this.currentUser$.asObservable();
  }

  private saveSession(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res));
    this.currentUser$.next(res);
  }

  private loadUser(): AuthResponse | null {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  /** Decode a JWT payload (base64url) without verifying — display purposes only. */
  private decodeJwt(token: string): any {
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}
