---
Task ID: 1
Agent: Main Agent
Task: Fix OAuth Error 400 invalid_request — Google policy non-compliance

Work Log:
- Read all 4 OAuth-related files: AuthScreen.tsx, LoginScreen.tsx, GoogleSignInWebView.tsx, google-web-auth.ts
- Read google-services.json, app.json, firebase.ts, api.ts for full context
- Identified root cause: Android used custom scheme redirect URI (black94://auth) with Web OAuth client
- Google OAuth 2.0 policy only accepts http(s) redirect URIs for Web clients — custom schemes are rejected
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

---
Task ID: 2
Agent: Main Agent
Task: Deep re-audit of OAuth fix — discovered Android HTTPS redirect doesn't work with expo-web-browser

Work Log:
- Re-read all 4 modified files line by line
- Traced full OAuth flow for both Android and iOS
- Verified PKCE implementation (sha256, base64url encoding, code_challenge)
- Tested sanitizeErrorMessage() against user's actual error text — all identifiers stripped correctly
- Researched expo-web-browser v15 Android behavior via sub-agent
- CRITICAL FINDING: expo-web-browser on Android uses Chrome Custom Tabs polyfill, which relies on Linking.addEventListener('url'). Chrome Custom Tabs does NOT intercept HTTPS redirects without verified Android App Links (requires hosting assetlinks.json on the domain). Firebase's shared domain (black94.firebaseapp.com) doesn't support custom assetlinks.json.
- This means the HTTPS redirect fix would NOT route back to the app on Android — user would be stuck in Chrome Custom Tabs
- Fixed: Changed Android auth strategy from ['native', 'web'] to ['native'] ONLY
- iOS unchanged: ['web', 'native'] (ASWebAuthenticationSession intercepts HTTPS redirects automatically, no App Links needed)
- DEVELOPER_ERROR handling updated: on Android, breaks immediately (no web fallback to try)
- Verified TypeScript compilation: 0 new errors
- Verified all 5 client IDs consistent
- Verified no black94://auth in code paths (only in comments)
- Verified PKCE crypto produces valid base64url (43 chars)

Stage Summary:
- google-web-auth.ts: HTTPS redirect for all platforms (used for iOS web OAuth)
- AuthScreen.tsx: Android = native Google Sign-In ONLY, iOS = web OAuth first + native fallback
- GoogleSignInWebView.tsx: Error page interception + sanitized error messages (defensive)
- app.json: HTTPS intent filter kept (doesn't hurt, useful if web OAuth re-enabled)
- Error sanitization verified: project-210565807767 → [project], tabiblia.ai@gmail.com → [email], URLs → [url]
- Branded error state: shows "Black94" only, no project IDs, no Firebase info, no developer email
- All changes compile cleanly, 0 new TypeScript errors
