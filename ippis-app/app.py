import base64
import hashlib
import os
import secrets
import time
import urllib.parse

import bcrypt
import psycopg2
import requests
from flask import Flask, flash, redirect, render_template, request, session, url_for

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key')

DB_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/authdb')

SSO_CLIENT_ID    = os.environ.get('SSO_CLIENT_ID',    'ippis-portal')
SSO_CLIENT_SECRET = os.environ.get('SSO_CLIENT_SECRET', 'ippis-secret-key')
AUTHORIZE_URL    = os.environ.get('SSO_AUTHORIZE_URL', 'http://localhost:8000/oauth2/authorize')
TOKEN_URL        = os.environ.get('SSO_TOKEN_URL',     'http://localhost:8000/oauth2/token')
USERINFO_URL     = os.environ.get('SSO_USERINFO_URL',  'http://localhost:8000/auth/userinfo')
LOGOUT_URL       = os.environ.get('SSO_LOGOUT_URL',    'http://localhost:8000/oauth2/logout')
REDIRECT_URI     = os.environ.get('REDIRECT_URI',      'http://localhost:5000/callback')
POST_LOGOUT_URI  = os.environ.get('POST_LOGOUT_REDIRECT_URI', 'http://localhost:5000/')


# ── Local database helpers ────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(DB_URL)


def init_db():
    for attempt in range(10):
        try:
            conn = get_db()
            cur = conn.cursor()
            cur.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(80) UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()
            cur.close()
            conn.close()
            print("Database ready.")
            return
        except Exception as e:
            print(f"DB not ready ({e}), retrying in 2s...")
            time.sleep(2)
    raise RuntimeError("Could not connect to database after 10 attempts")


# ── SSO helpers ───────────────────────────────────────────────────────────────

def _pkce_pair():
    verifier  = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode()
    digest    = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
    return verifier, challenge


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    if 'username' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'username' in session:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT id, password_hash FROM users WHERE username = %s', (username,))
        user = cur.fetchone()
        cur.close()
        conn.close()
        if user and bcrypt.checkpw(password.encode(), user[1].encode()):
            session['user_id']  = user[0]
            session['username'] = username
            return redirect(url_for('dashboard'))
        flash('Invalid username or password.')
    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        if len(username) < 3 or len(password) < 6:
            flash('Username min 3 chars, password min 6 chars.')
            return render_template('register.html')
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        try:
            conn = get_db()
            cur = conn.cursor()
            cur.execute('INSERT INTO users (username, password_hash) VALUES (%s, %s)',
                        (username, pw_hash))
            conn.commit()
            cur.close()
            conn.close()
            flash('Account created — please log in.')
            return redirect(url_for('login'))
        except psycopg2.IntegrityError:
            flash('Username already taken.')
    return render_template('register.html')


@app.route('/sso-login')
def sso_login():
    verifier, challenge = _pkce_pair()
    state = secrets.token_urlsafe(32)
    session['pkce_verifier'] = verifier
    session['oauth_state']   = state
    params = {
        'client_id':             SSO_CLIENT_ID,
        'redirect_uri':          REDIRECT_URI,
        'response_type':         'code',
        'scope':                 'openid profile email',
        'state':                 state,
        'code_challenge':        challenge,
        'code_challenge_method': 'S256',
    }
    return redirect(f"{AUTHORIZE_URL}?{urllib.parse.urlencode(params)}")


@app.route('/callback')
def callback():
    error = request.args.get('error')
    if error:
        flash(f"SSO sign-in failed: {request.args.get('error_description', error)}")
        return redirect(url_for('login'))

    code  = request.args.get('code')
    state = request.args.get('state')

    if not code or not state or state != session.pop('oauth_state', None):
        flash('Invalid callback. Please try again.')
        return redirect(url_for('login'))

    verifier = session.pop('pkce_verifier', None)
    if not verifier:
        flash('Session expired. Please log in again.')
        return redirect(url_for('login'))

    try:
        token_resp = requests.post(TOKEN_URL, data={
            'grant_type':    'authorization_code',
            'code':          code,
            'redirect_uri':  REDIRECT_URI,
            'client_id':     SSO_CLIENT_ID,
            'client_secret': SSO_CLIENT_SECRET,
            'code_verifier': verifier,
        }, timeout=15)
        token_resp.raise_for_status()
    except requests.RequestException:
        flash('Token exchange failed — SSO service unavailable.')
        return redirect(url_for('login'))

    tokens       = token_resp.json()
    access_token = tokens.get('access_token')
    if not access_token:
        flash('No access token received from SSO.')
        return redirect(url_for('login'))

    try:
        userinfo_resp = requests.get(USERINFO_URL, headers={
            'Authorization': f'Bearer {access_token}'
        }, timeout=10)
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()
    except requests.RequestException:
        flash('Could not retrieve user info from SSO.')
        return redirect(url_for('login'))

    session['username']  = (
        userinfo.get('preferred_username')
        or userinfo.get('username')
        or userinfo.get('email')
        or userinfo.get('sub', 'unknown')
    )
    session['sso']       = True
    session['id_token']  = tokens.get('id_token')

    return redirect(url_for('dashboard'))


@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        return redirect(url_for('login'))
    return render_template('dashboard.html', username=session['username'])


@app.route('/logout')
def logout():
    id_token = session.get('id_token')
    is_sso   = session.get('sso', False)
    session.clear()
    if is_sso:
        params = {
            'client_id':                SSO_CLIENT_ID,
            'post_logout_redirect_uri': POST_LOGOUT_URI,
        }
        if id_token:
            params['id_token_hint'] = id_token
        return redirect(f"{LOGOUT_URL}?{urllib.parse.urlencode(params)}")
    return redirect(url_for('login'))


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000,
            debug=os.environ.get('DEBUG', 'false').lower() == 'true')
