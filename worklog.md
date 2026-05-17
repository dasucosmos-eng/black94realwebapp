---
Task ID: 1
Agent: Main Agent
Task: Fix multiple app bugs — tsToMillis crash, invisible Follow button, big buttons, missing comments, error boundary

Work Log:
- Analyzed all bug reports from user screenshots and descriptions
- Read all relevant source files: AuthScreen.tsx, ProfileScreen.tsx, UserProfileScreen.tsx, PostCommentsScreen.tsx, CommentSheet.tsx, api.ts, datetime.ts, app.js, stores/app.ts
- Identified root causes for all 5 reported issues

Fix 1: tsToMillis crash on login
- Root cause: signInWithGoogle in api.ts called tsToMillis(existingData?.createdAt) without try/catch. If createdAt was an unexpected type, the whole sign-in would fail.
- Also: stores/app.ts safeUser did `data.createdAt || Date.now()` which passes through raw Firestore Timestamp objects (truthy).
- Also: 10 bare tsToMillis() calls in screen files could crash individual screens.
- Fix: Wrapped tsToMillis call in signInWithGoogle with try/catch. Changed safeUser to use tsToMillis(). Wrapped all 10 screen-level tsToMillis calls with try/catch IIFEs.

Fix 2: Follow button text invisible (white on white)
- Root cause: UserProfileScreen followBtnText had `color: '#e7e9ea'` (light gray) but the followBtn background is also `#e7e9ea` — making text invisible.
- Fix: Changed followBtnText color from `#e7e9ea` to `#000000` (black on light button).

Fix 3: Follow and Message buttons too big
- Root cause: Buttons had height: 44px and fontSize: 15px, looked oversized.
- Fix: UserProfileScreen: height 44→36, borderRadius 22→18, fontSize 15→14. ProfileScreen: paddingVertical 8→6, paddingHorizontal reduced, fontSize 15→14.

Fix 4: Missing comments (count shows but sheet is empty)
- Root cause: fetchPostComments in api.ts caught errors and silently returned [] — user sees empty list instead of an error.
- Fix: Changed fetchPostComments to throw errors instead of swallowing. Updated PostCommentsScreen and CommentSheet to catch errors and show "Could not load replies" with Retry button. Added null postId guard and debug logging.

Fix 5: Error boundary showing raw technical errors
- Root cause: AppErrorBoundary showed raw error messages like "Property 'ts toMillis' doesn't exist" directly to users.
- Fix: Added sanitizeError() method that strips technical terms (toMillis, project IDs, emails, URLs, etc.) and shows user-friendly messages.

Stage Summary:
- Files modified: src/lib/api.ts, src/screens/PostCommentsScreen.tsx, src/components/CommentSheet.tsx, src/screens/UserProfileScreen.tsx, src/screens/ProfileScreen.tsx, src/stores/app.ts, App.js
- Also modified by subagent: src/screens/NotificationsScreen.tsx, src/screens/FeedScreen.tsx, src/screens/BookmarksScreen.tsx (tsToMillis wrapping)
- All changes are defensive — they prevent crashes and show user-friendly messages instead of raw errors
- No changes to navigation, firebase config, or OAuth flow
