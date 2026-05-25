import os
import hashlib
import secrets
import base64
import requests
from urllib.parse import urlencode
from flask import Flask, render_template, request, redirect, url_for, session

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key')

# ── SSO configuration ────────────────────────────────────────────────────────
CLIENT_ID     = os.environ.get('SSO_CLIENT_ID',               'ippis-portal')
CLIENT_SECRET = os.environ.get('SSO_CLIENT_SECRET',           'ippis-secret-key')
AUTHORIZE_URL = os.environ.get('SSO_AUTHORIZE_URL',           'http://localhost:8000/oauth2/authorize')
TOKEN_URL     = os.environ.get('SSO_TOKEN_URL',               'http://localhost:8000/oauth2/token')
LOGOUT_URL    = os.environ.get('SSO_LOGOUT_URL',              'http://localhost:8000/oauth2/logout')
USERINFO_URL  = os.environ.get('SSO_USERINFO_URL',            'http://localhost:8000/auth/userinfo')
REDIRECT_URI  = os.environ.get('REDIRECT_URI',                'http://localhost:5000/callback')
POST_LOGOUT_REDIRECT_URI = os.environ.get('POST_LOGOUT_REDIRECT_URI', 'http://localhost:5000/')

# ── SDK (optional — falls back to raw HTTP if package not installed) ─────────
try:
    from GoRSSO import GoRSSOClient
    _sso = GoRSSOClient(host=os.environ.get('SSO_BASE_URL', 'http://localhost:8000'))
    SDK_AVAILABLE = True
except ImportError:
    SDK_AVAILABLE = False
    _sso = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _pkce_pair():
    """Return (verifier, S256-challenge) for one PKCE exchange."""
    verifier  = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode()
    digest    = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
    return verifier, challenge


def _get_userinfo(access_token):
    """Fetch /auth/userinfo via SDK when available, otherwise raw HTTP."""
    if SDK_AVAILABLE:
        try:
            _sso.set_access_token(access_token)
            return _sso.auth.get_user_info()
        except Exception:
            pass
    resp = requests.get(
        USERINFO_URL,
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    if 'access_token' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login')
def login():
    if 'access_token' in session:
        return redirect(url_for('dashboard'))

    # Show the page only when redirected back here after an error.
    error = request.args.get('error')
    if error:
        return render_template('login.html', error=error)

    # Happy path: generate PKCE pair + state, then send the browser to SSO.
    verifier, challenge = _pkce_pair()
    state = secrets.token_urlsafe(32)
    session['pkce_verifier'] = verifier
    session['oauth_state']   = state

    params = {
        'client_id':             CLIENT_ID,
        'redirect_uri':          REDIRECT_URI,
        'response_type':         'code',
        'code_challenge':        challenge,
        'code_challenge_method': 'S256',
        'state':                 state,
        'scope':                 'openid profile email',
    }
    return redirect(f"{AUTHORIZE_URL}?{urlencode(params)}")


@app.route('/callback')
def callback():
    # SSO returned an error (e.g. user cancelled login).
    error = request.args.get('error')
    if error:
        desc = request.args.get('error_description', error)
        return redirect(url_for('login', error=desc))

    code  = request.args.get('code')
    state = request.args.get('state')

    if not code or not state:
        return redirect(url_for('login', error='Invalid callback — missing code or state.'))

    # CSRF guard: state must match what we stored before the redirect.
    if state != session.pop('oauth_state', None):
        return redirect(url_for('login', error='State mismatch. Please try again.'))

    verifier = session.pop('pkce_verifier', None)
    if not verifier:
        return redirect(url_for('login', error='Session expired. Please log in again.'))

    # Exchange the authorization code for tokens.
    try:
        token_resp = requests.post(TOKEN_URL, data={
            'grant_type':    'authorization_code',
            'code':          code,
            'redirect_uri':  REDIRECT_URI,
            'client_id':     CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'code_verifier': verifier,
        }, timeout=15)
        token_resp.raise_for_status()
    except requests.RequestException:
        return redirect(url_for('login', error='Token exchange failed — SSO service unavailable.'))

    tokens       = token_resp.json()
    access_token = tokens.get('access_token')
    if not access_token:
        return redirect(url_for('login', error='No access token received from SSO.'))

    # Fetch user profile using the SDK (falls back to raw HTTP automatically).
    try:
        userinfo = _get_userinfo(access_token)
    except Exception:
        return redirect(url_for('login', error='Could not retrieve user info from SSO.'))

    # Persist tokens and identity in the server-side session.
    session['access_token']  = access_token
    session['refresh_token'] = tokens.get('refresh_token')
    session['id_token']      = tokens.get('id_token')   # required for SSO logout
    session['username']      = (
        userinfo.get('preferred_username')
        or userinfo.get('email')
        or userinfo.get('sub', 'unknown')
    )
    session['full_name']     = userinfo.get('name') or session['username']
    session['email']         = userinfo.get('email', '')
    session['roles']         = userinfo.get('roles', [])

    return redirect(url_for('dashboard'))


@app.route('/dashboard')
def dashboard():
    if 'access_token' not in session:
        return redirect(url_for('login'))
    return render_template(
        'dashboard.html',
        username=session.get('full_name') or session.get('username'),
        email=session.get('email', ''),
        roles=session.get('roles', []),
    )


@app.route('/logout')
def logout():
    id_token = session.get('id_token')
    session.clear()

    params = {
        'client_id':                CLIENT_ID,
        'post_logout_redirect_uri': POST_LOGOUT_REDIRECT_URI,
    }
    if id_token:
        params['id_token_hint'] = id_token   # required for proper SSO session termination

    return redirect(f"{LOGOUT_URL}?{urlencode(params)}")


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=os.environ.get('DEBUG', 'false').lower() == 'true',
    )
