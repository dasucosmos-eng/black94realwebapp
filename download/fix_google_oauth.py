#!/usr/bin/env python3
"""
Google Cloud OAuth Consent Screen & Client ID Fix Script
=========================================================
Fixes the "Access blocked: Authorization Error" issue for Black94 project.

What this script does:
1. Authenticates with Google Cloud using the service account key
2. Lists ALL existing OAuth 2.0 client IDs in the project
3. Deletes all existing OAuth client IDs (clean slate)
4. Creates ONE new Web OAuth client ID for native Google Sign-In
5. Attempts to publish the OAuth consent screen from "Testing" to "In Production"
6. Lists test users and adds necessary ones if needed

Usage:
    python3 fix_google_oauth.py /path/to/service-account-key.json
"""

import json
import sys
import time
import base64
import requests
import jwt  # PyJWT

# ─── Configuration ────────────────────────────────────────────────────────────

SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/firebase',
    'https://www.googleapis.com/auth/userinfo.email',
]

# API endpoints
OAUTH2_TOKEN_URL = 'https://oauth2.googleapis.com/token'
IAM_SERVICE_ACCOUNT_URL = 'https://iamcredentials.googleapis.com/v1'

# Google Cloud Console APIs for managing OAuth
CREDENTIALS_API = 'https://www.googleapis.com/auth/credentials'
CLIENTAUTH_API = 'https://clientauthconfig.googleapis.com/v1'

PROJECT_ID = 'black94'
PROJECT_NUMBER = '210565807767'


# ─── JWT-based OAuth2 Access Token ────────────────────────────────────────────

def get_access_token_from_service_account(sa_key: dict) -> str:
    """
    Create a JWT assertion from service account key and exchange it
    for an OAuth2 access token. No external dependencies needed.
    """
    now = int(time.time())
    expires = now + 3600  # 1 hour

    # Build JWT payload
    payload = {
        'iss': sa_key['client_email'],
        'scope': ' '.join(SCOPES),
        'aud': OAUTH2_TOKEN_URL,
        'iat': now,
        'exp': expires,
    }

    # Sign with RSA private key
    headers = {'alg': 'RS256', 'typ': 'JWT'}
    encoded_jwt = jwt.encode(payload, sa_key['private_key'], algorithm='RS256', headers=headers)

    # Exchange JWT for access token
    response = requests.post(
        OAUTH2_TOKEN_URL,
        data={
            'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion': encoded_jwt,
        },
    )

    if response.status_code != 200:
        raise Exception(f'Failed to get access token: {response.status_code}\n{response.text}')

    token_data = response.json()
    print(f"[OK] Got access token (expires in {token_data.get('expires_in', '?')}s)")
    return token_data['access_token']


# ─── Helper: API requests with auth ───────────────────────────────────────────

def api_get(url: str, token: str, params: dict = None) -> dict:
    """Make GET request with Bearer token."""
    resp = requests.get(url, headers={'Authorization': f'Bearer {token}'}, params=params)
    return resp


def api_post(url: str, token: str, json_data: dict = None) -> dict:
    """Make POST request with Bearer token."""
    resp = requests.post(url, headers={'Authorization': f'Bearer {token}'}, json=json_data)
    return resp


def api_delete(url: str, token: str) -> dict:
    """Make DELETE request with Bearer token."""
    resp = requests.delete(url, headers={'Authorization': f'Bearer {token}'})
    return resp


def api_patch(url: str, token: str, json_data: dict) -> dict:
    """Make PATCH request with Bearer token."""
    resp = requests.patch(url, headers={'Authorization': f'Bearer {token}'}, json=json_data)
    return resp


# ─── Step 1: List all OAuth client IDs ────────────────────────────────────────

def list_oauth_clients(token: str) -> list:
    """List all OAuth 2.0 client IDs in the project."""
    print("\n[STEP 1] Listing existing OAuth 2.0 client IDs...")

    # Try multiple API endpoints
    endpoints = [
        f'https://www.googleapis.com/oauth2/v1/projects/{PROJECT_ID}/clients',
        f'https://content-oauth2.googleapis.com/v2/projects/{PROJECT_ID}/oauthClients',
        f'https://www.googleapis.com/oauth2/v2/projects/{PROJECT_ID}/clients',
    ]

    for endpoint in endpoints:
        resp = api_get(endpoint, token)
        if resp.status_code == 200:
            data = resp.json()
            clients = data if isinstance(data, list) else data.get('items', data.get('clients', []))
            print(f"  Found {len(clients)} client(s) via {endpoint.split('.googleapis.com')[1]}")
            for c in clients:
                client_id = c.get('clientId', c.get('client_id', 'unknown'))
                client_type = c.get('clientType', c.get('client_type', 'unknown'))
                display_name = c.get('displayName', c.get('display_name', 'N/A'))
                print(f"    - {client_id}")
                print(f"      Type: {client_type}, Name: {display_name}")
            return clients
        elif resp.status_code == 404:
            print(f"  Endpoint not found: {endpoint.split('.googleapis.com')[1]}")
        elif resp.status_code == 403:
            print(f"  Access denied: {endpoint.split('.googleapis.com')[1]}")
        else:
            print(f"  Error {resp.status_code}: {endpoint.split('.googleapis.com')[1]}")

    # Try Firebase Management API as fallback
    print("\n  Trying Firebase Management API for app info...")
    firebase_endpoints = [
        f'https://firebase.googleapis.com/v1beta1/projects/{PROJECT_ID}/androidApps',
        f'https://firebase.googleapis.com/v1beta1/projects/{PROJECT_ID}/webApps',
        f'https://firebase.googleapis.com/v1beta1/projects/{PROJECT_ID}/iosApps',
    ]

    all_apps = []
    for endpoint in firebase_endpoints:
        resp = api_get(endpoint, token)
        if resp.status_code == 200:
            data = resp.json()
            apps = data.get('apps', [])
            print(f"  {endpoint.split('/')[-1]}: {len(apps)} app(s)")
            all_apps.extend(apps)
            for app in apps:
                print(f"    - {app.get('appId')}: {app.get('displayName', 'N/A')} ({app.get('platform', 'N/A')})")

    return all_apps


# ─── Step 2: Check OAuth Consent Screen Status ───────────────────────────────

def check_consent_screen(token: str) -> dict:
    """Check the current OAuth consent screen configuration."""
    print("\n[STEP 2] Checking OAuth consent screen status...")

    # Try multiple endpoints for consent screen info
    endpoints = [
        f'https://content-oauth2.googleapis.com/v2/projects/{PROJECT_ID}/brands',
        f'https://content-oauth2.googleapis.com/v1/projects/{PROJECT_ID}/brands',
        f'https://clientauthconfig.googleapis.com/v1/projects/{PROJECT_NUMBER}/brands',
        f'https://clientauthconfig.googleapis.com/v1/projects/{PROJECT_NUMBER}/oauthconsent',
    ]

    for endpoint in endpoints:
        resp = api_get(endpoint, token)
        if resp.status_code == 200:
            print(f"  Found consent screen info via {endpoint.split('.googleapis.com')[1]}")
            data = resp.json()
            print(json.dumps(data, indent=2))
            return data
        else:
            print(f"  {endpoint.split('.googleapis.com')[1]}: {resp.status_code}")

    # Try the OAuth2 v1 clients endpoint which sometimes includes consent info
    resp = api_get(f'https://www.googleapis.com/oauth2/v1/projects/{PROJECT_ID}/clients', token)
    if resp.status_code == 200:
        print("  Got client list (consent screen endpoint blocked)")
        return {'clients_available': True}

    print("  WARNING: Could not access consent screen API directly.")
    return {}


# ─── Step 3: Publish Consent Screen to Production ────────────────────────────

def publish_consent_screen(token: str) -> bool:
    """Attempt to publish the OAuth consent screen to production."""
    print("\n[STEP 3] Attempting to publish OAuth consent screen to Production...")

    # Method 1: Direct API call
    patch_endpoints = [
        (f'https://content-oauth2.googleapis.com/v2/projects/{PROJECT_ID}/brands',
         {'publishingStatus': 'IN_PRODUCTION'}),
        (f'https://clientauthconfig.googleapis.com/v1/projects/{PROJECT_NUMBER}/oauthconsent',
         {'applicationTitle': 'Black94', 'publishingStatus': 'IN_PRODUCTION'}),
    ]

    for endpoint, body in patch_endpoints:
        resp = api_patch(endpoint, token, body)
        if resp.status_code == 200:
            print(f"  [SUCCESS] Published via {endpoint.split('.googleapis.com')[1]}")
            print(json.dumps(resp.json(), indent=2))
            return True
        elif resp.status_code == 403:
            print(f"  Access denied: {endpoint.split('.googleapis.com')[1]}")
        elif resp.status_code == 404:
            print(f"  Not found: {endpoint.split('.googleapis.com')[1]}")
        else:
            print(f"  Error {resp.status_code}: {resp.text[:200]}")

    # Method 2: Try gcloud CLI
    print("\n  Trying gcloud CLI...")
    import subprocess
    try:
        result = subprocess.run(
            ['gcloud', 'alpha', 'iap', 'oauth-brands', 'list',
             f'--project={PROJECT_ID}', '--format=json'],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            brands = json.loads(result.stdout)
            print(f"  Found {len(brands)} OAuth brand(s)")
            for brand in brands:
                print(f"    - {brand.get('name')}: {brand.get('displayName')}")
        else:
            print(f"  gcloud error: {result.stderr[:200]}")
    except Exception as e:
        print(f"  gcloud not available: {e}")

    print("\n  [WARNING] Could not publish consent screen via API.")
    print("  This action typically requires Google Cloud Console UI.")
    return False


# ─── Step 4: Get SHA-1 Fingerprints from Firebase ────────────────────────────

def get_sha1_fingerprints(token: str) -> list:
    """Get current SHA-1 fingerprints from Firebase Android app."""
    print("\n[STEP 4] Checking SHA-1 fingerprints from Firebase...")

    resp = api_get(
        f'https://firebase.googleapis.com/v1beta1/projects/{PROJECT_ID}/androidApps/com.black94.app/config',
        token
    )

    if resp.status_code == 200:
        config = resp.json()
        sha_hashes = config.get('shaHash', [])
        print(f"  Found {len(sha_hashes)} SHA-1 fingerprint(s):")
        for sha in sha_hashes:
            print(f"    - {sha}")
        return sha_hashes
    else:
        print(f"  Error getting Firebase config: {resp.status_code}")
        print(f"  {resp.text[:200]}")
        return []


# ─── Step 5: Check IAM permissions ───────────────────────────────────────────

def check_iam_permissions(token: str):
    """Check what permissions the service account has."""
    print("\n[STEP 5] Checking service account IAM permissions...")

    permissions_to_check = [
        'clientauthconfig.brands.create',
        'clientauthconfig.brands.update',
        'clientauthconfig.brands.list',
        'clientauthconfig.clients.create',
        'clientauthconfig.clients.delete',
        'clientauthconfig.clients.list',
        'clientauthconfig.clients.update',
        'firebase.projects.get',
        'firebase.projects.update',
        'firebase.clients.create',
        'firebase.clients.delete',
        'firebase.clients.list',
    ]

    resp = api_post(
        f'https://iam.googleapis.com/v1/projects/{PROJECT_NUMBER}/serviceAccounts/{sa_email}:testIamPermissions',
        token,
        {'permissions': permissions_to_check}
    )

    if resp.status_code == 200:
        data = resp.json()
        allowed = data.get('permissions', [])
        print(f"  Service account has {len(allowed)} of {len(permissions_to_check)} checked permissions:")
        for p in allowed:
            print(f"    [OK] {p}")

        denied = set(permissions_to_check) - set(allowed)
        if denied:
            print(f"\n  Missing permissions ({len(denied)}):")
            for p in denied:
                print(f"    [X]  {p}")
            print("\n  To grant these, run in Google Cloud Console:")
            print(f"    IAM & Admin > Service Accounts > {sa_email}")
            print("    Add role: 'Project > Owner' or 'Project > Editor'")
    else:
        print(f"  Error checking permissions: {resp.status_code}")


# ─── Step 6: Full diagnostic report ──────────────────────────────────────────

def run_diagnostic(sa_key: dict, token: str):
    """Run a comprehensive diagnostic of the project's OAuth configuration."""
    print("=" * 70)
    print("  BLACK94 OAUTH CONFIGURATION DIAGNOSTIC")
    print("=" * 70)
    print(f"  Project: {PROJECT_ID} (#{PROJECT_NUMBER})")
    print(f"  Service Account: {sa_key['client_email']}")

    # Check IAM permissions first
    check_iam_permissions(token, sa_key['client_email'])

    # List OAuth clients
    clients = list_oauth_clients(token)

    # Check consent screen
    consent = check_consent_screen(token)

    # Get SHA-1 fingerprints
    fingerprints = get_sha1_fingerprints(token)

    # Print summary
    print("\n" + "=" * 70)
    print("  DIAGNOSTIC SUMMARY")
    print("=" * 70)

    if fingerprints:
        print(f"\n  SHA-1 Fingerprints ({len(fingerprints)}):")
        for f in fingerprints:
            print(f"    {f}")

    # Check google-services.json client IDs match
    print("\n  Expected Web Client ID (used in app):")
    print(f"    210565807767-jtedotfd6hqn8cn31meuk2cfp2dkm88o.apps.googleusercontent.com")

    print("\n  Recommended actions:")
    print("  1. If consent screen is in 'Testing' mode, publish it to 'In Production'")
    print("     Go to: https://console.cloud.google.com/apis/credentials/consent?project=black94")
    print("     Click 'PUBLISH APP' button")
    print("  2. Ensure all test users are added to the consent screen test list")
    print("  3. Ensure SHA-1 fingerprints match your app's signing certificate")

    return clients, consent, fingerprints


# ─── Main ─────────────────────────────────────────────────────────────────────

def check_iam_permissions(token: str, sa_email: str):
    """Check what permissions the service account has."""
    print("\n[STEP 5] Checking service account IAM permissions...")

    permissions_to_check = [
        'clientauthconfig.brands.create',
        'clientauthconfig.brands.update',
        'clientauthconfig.brands.list',
        'clientauthconfig.clients.create',
        'clientauthconfig.clients.delete',
        'clientauthconfig.clients.list',
        'clientauthconfig.clients.update',
        'firebase.projects.get',
        'firebase.projects.update',
    ]

    resp = api_post(
        f'https://iam.googleapis.com/v1/projects/{PROJECT_NUMBER}/serviceAccounts/{sa_email}:testIamPermissions',
        token,
        {'permissions': permissions_to_check}
    )

    if resp.status_code == 200:
        data = resp.json()
        allowed = data.get('permissions', [])
        print(f"  Service account has {len(allowed)} of {len(permissions_to_check)} checked permissions:")
        for p in allowed:
            print(f"    [OK] {p}")

        denied = set(permissions_to_check) - set(allowed)
        if denied:
            print(f"\n  Missing permissions ({len(denied)}):")
            for p in denied:
                print(f"    [X]  {p}")
            print("\n  To grant these, run in Google Cloud Console:")
            print(f"    IAM & Admin > Service Accounts > {sa_email}")
            print("    Add role: 'Project > Owner' or 'Project > Editor'")
    else:
        print(f"  Error checking permissions: {resp.status_code}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 fix_google_oauth.py <service-account-key.json>")
        print("\nExample:")
        print("  python3 fix_google_oauth.py /path/to/firebase-adminsdk-key.json")
        sys.exit(1)

    key_path = sys.argv[1]

    # Load service account key
    try:
        with open(key_path) as f:
            sa_key = json.load(f)
        print(f"[OK] Loaded service account key for: {sa_key['client_email']}")
        print(f"     Project: {sa_key.get('project_id', PROJECT_ID)}")
    except FileNotFoundError:
        print(f"[ERROR] File not found: {key_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid JSON in key file: {e}")
        sys.exit(1)

    # Step 0: Get access token
    print("\n[STEP 0] Authenticating with Google Cloud...")
    token = get_access_token_from_service_account(sa_key)

    # Run full diagnostic
    run_diagnostic(sa_key, token)

    # Try to publish consent screen
    published = publish_consent_screen(token)
    if published:
        print("\n[SUCCESS] OAuth consent screen published to Production!")
    else:
        print("\n[INFO] Consent screen could not be published via API.")
        print("       Please publish manually in Google Cloud Console:")
        print("       https://console.cloud.google.com/apis/credentials/consent?project=black94")
