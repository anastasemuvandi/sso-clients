import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthResponse {
  token: string;
  username: string;
  email: string;
  fullName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'rmis_token';
  private readonly USER_KEY = 'rmis_user';

  private currentUser$ = new BehaviorSubject<AuthResponse | null>(this.loadUser());

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { username, password }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  register(username: string, email: string, password: string, fullName: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, { username, email, password, fullName }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  // [GoR-SSO] Store a session from an SSO-issued JWT (no username/password call).
  // [GoR-SSO] REUSABLE ACROSS APPS: it only depends on the JWT, decoding whatever
  // [GoR-SSO] standard claims are present to populate the displayed user.
  loginWithSsoToken(token: string): void {
    const claims = this.decodeJwt(token);                       // [GoR-SSO] read the JWT payload
    const res: AuthResponse = {                                 // [GoR-SSO] map claims -> our session shape
      token,                                                    // [GoR-SSO] the raw JWT (sent by the interceptor)
      username: claims?.sub ?? claims?.preferred_username ?? '',// [GoR-SSO] RMIS JWT subject = username
      email: claims?.email ?? '',                               // [GoR-SSO] present only if the app puts it in the JWT
      fullName: claims?.name ?? claims?.fullName ?? ''          // [GoR-SSO] present only if the app puts it in the JWT
    };
    this.saveSession(res);                                      // [GoR-SSO] reuse the same persistence as local login
  }

  // [GoR-SSO] Decode a JWT payload (base64url) WITHOUT verifying the signature —
  // [GoR-SSO] this is display-only; the backend already validated the token.
  private decodeJwt(token: string): any {
    try {                                                       // [GoR-SSO] malformed token -> null (caller handles)
      const payload = token.split('.')[1];                      // [GoR-SSO] JWT = header.payload.signature
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/'); // [GoR-SSO] base64url -> base64
      const json = decodeURIComponent(                          // [GoR-SSO] decode UTF-8 bytes safely
        atob(base64).split('').map(c =>                         // [GoR-SSO] atob -> binary string
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2) // [GoR-SSO] each byte -> %XX
        ).join('')
      );
      return JSON.parse(json);                                  // [GoR-SSO] -> claims object
    } catch {
      return null;                                              // [GoR-SSO]
    }
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser$.next(null);
    this.router.navigate(['/login']);
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
}
