---
Task ID: 1
Agent: Main Agent
Task: Fix OAuth Error 400 invalid_request — Google policy non-compliance

Work Log:
- Read all 4 OAuth-related files: AuthScreen.tsx, LoginScreen.tsx, GoogleSignInWebView.tsx, google-web-auth.ts
- Read google-services.json, app.json, firebase.ts, api.ts for full context
- Identified root cause: Android used custom scheme redirect URI (black94://auth) with Web OAuth client
- Google OAuth 2.0 policy only accepts http(s) redirect URIs for Web clients — custom schemes are rejected
- This caused Error 400: invalid_request with policy non-compliance message
- Changed google-web-auth.ts: getRedirectUri() now returns HTTPS URL for ALL platforms
- Added sanitizeErrorMessage() to strip project IDs, emails, Firebase URLs from error messages
- Updated GoogleSignInWebView.tsx: Added error page interception in onShouldStartLoadWithRequest
- Updated AuthScreen.tsx: Added branded error state with Try Again button and Contact Support link
- Updated app.json: Added HTTPS intent filter for Android App Links (autoVerify)
- Verified TypeScript compilation passes (3 pre-existing errors in App.js/ChatListScreen.tsx, none in changed files)
- Verified all 5 client ID references are consistent

Stage Summary:
- google-web-auth.ts: Changed redirect from black94://auth (Android) to https://black94.firebaseapp.com/__/auth/handler (all platforms)
- GoogleSignInWebView.tsx: Added error interception + sanitized error messages
- AuthScreen.tsx: Added branded error state (no project IDs, no Firebase info ever shown)
- app.json: Added HTTPS intent filter with autoVerify for Android App Links
- All changes compile cleanly
