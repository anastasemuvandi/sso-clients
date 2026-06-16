import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthResponse {
  token: string;
  email: string;
  fullName: string;
}

export interface LoginResponse {
  twoFactorRequired: boolean;
  email: string;
  message: string;
}

export interface MessageResponse {
  message: string;
}

export interface UserProfile {
  email: string;
  fullName: string;
  phoneNumber: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'ikimina_token';
  private readonly USER_KEY = 'ikimina_user';
  private readonly ID_TOKEN_KEY = 'ikimina_id_token';   // SSO id_token, for RP-initiated logout

  private currentUser$ = new BehaviorSubject<AuthResponse | null>(this.loadUser());

  constructor(private http: HttpClient, private router: Router) {}

  // ── Auth flows ────────────────────────────────────────────────────────────

  register(email: string, password: string, fullName: string, phoneNumber: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${environment.apiUrl}/auth/register`,
      { email, password, fullName, phoneNumber });
  }

  /** Step 1: verify password. On success the backend emails a 2FA code. */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password });
  }

  /** Step 2: submit the emailed code to finish login and receive the JWT. */
  verifyTwoFactor(email: string, code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/verify-2fa`, { email, code }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  /** SSO: store a session from a JWT the backend minted (no 2FA round-trip).
   *  Pass the OIDC id_token too (from the callback fragment) so logout() can do
   *  RP-initiated sign-out. */
  loginWithSsoToken(token: string, idToken?: string | null): void {
    const c = this.decodeJwt(token);                          // payload, for display only
    this.saveSession({
      token,
      email: c?.email ?? '',
      fullName: c?.name ?? c?.fullName ?? ''
    });
    if (idToken) {
      localStorage.setItem(this.ID_TOKEN_KEY, idToken);
    }
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(email: string, code: string, newPassword: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${environment.apiUrl}/auth/reset-password`,
      { email, code, newPassword });
  }

  // ── Profile (authenticated) ─────────────────────────────────────────────────

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${environment.apiUrl}/user/me`);
  }

  /** Returns a fresh AuthResponse (email may change, so the token is reissued). */
  updateProfile(email: string, fullName: string, phoneNumber: string): Observable<AuthResponse> {
    return this.http.put<AuthResponse>(`${environment.apiUrl}/user/profile`,
      { email, fullName, phoneNumber }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${environment.apiUrl}/user/password`,
      { currentPassword, newPassword });
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
