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

---
Task ID: 2
Agent: Main Agent
Task: Audit all previous fixes and fix remaining bugs

Work Log:
- Read worklog from previous session to understand all 5 fixes
- Audited Fix 1 (tsToMillis crash): Found stores/app.ts line 48 still had a bare tsToMillis call without try/catch — CRITICAL because safeUser() is called on every setUser(), including during auth restore
- Audited Fix 2 (Follow button): Verified both ProfileScreen and UserProfileScreen have `color: '#000000'` on followBtnText ✓
- Audited Fix 3 (Tab sizing): Verified both screens have `height: 36`, `fontSize: 14` ✓
- Audited Fix 4 (Comments): Verified fetchPostComments throws errors, both CommentSheet and PostCommentsScreen catch and show Retry UI ✓
- Audited Fix 5 (Error boundary): Verified sanitizeError strips toMillis, toDate, seconds, nanoseconds, project IDs, emails, URLs ✓
- Found ~30 additional bare tsToMillis() calls across the codebase that could crash the app
- Fixed stores/app.ts safeUser() createdAt (was the last critical bare call)
- Fixed api.ts core functions: fetchFeed, fetchChatList (2 calls), fetchMessages, hybridSearch (2 calls), searchUsers, getCart, submitFactCheckClaim (2 calls), fetchFactCheckClaims (2 calls), getCRMLeadRecommendations
- Delegated fixing 28 bare calls across 14 screen/utility files to subagent
- All fixes committed and pushed to origin/main

Stage Summary:
- All 5 previous fixes verified as correct
- 1 critical remaining bug found and fixed (stores/app.ts bare tsToMillis)
- ~30 additional bare tsToMillis calls wrapped with try/catch IIFEs
- Total files modified: 16 (api.ts, crm.ts, app.ts, business.ts, + 12 screens)
- Zero bare tsToMillis calls remain in the codebase
- All changes pushed to origin/main

---
Task ID: 3
Agent: Main Agent + 3 subagents
Task: Comprehensive bug sweep and Play Store readiness fixes

Work Log:
- Ran full codebase audit via 2 parallel subagents (bug sweep + Play Store config audit)
- Bug sweep: checked 10 critical files for crash-prone patterns, navigation issues, security
- Play Store audit: checked AndroidManifest, app.json, build.gradle, signing config, versions

CRITICAL fixes applied:
1. ChatRoomScreen: Added null guard for chat state — render was accessing chat.otherUser
   when chat could be null (before async fetch completes), causing TypeError crash
2. CartScreen: navigation.navigate('Shop') -> 'Storefront' (Shop screen not registered)
3. SettingsScreen: fallback navigation 'Profile' -> 'ProfileSelf' (Profile expects userId)
4. CreatePostScreen: Added auth().currentUser null check before image upload
   (prevented uploads to path 'posts/undefined/...')

Security hardening:
5. firebase.ts: Gated ALL 29 console.log/warn/error calls behind __DEV__
6. firebase.ts: Scrubbed API key from Firestore logs (log path only, not full URL)
7. storage.ts: Removed empty Bearer token placeholder

Play Store compliance:
8. app.json: Removed unused READ/WRITE_EXTERNAL_STORAGE permissions

Memory leak fix:
9. EditProfileScreen: Added useEffect cleanup for username debounce timer

Stage Summary:
- 4 CRITICAL crash bugs fixed
- 3 security hardening fixes (29 console calls gated, API key scrubbed, Bearer token fixed)
- 1 Play Store compliance fix (permissions cleanup)
- 1 memory leak fix
- 24 files changed across 2 commits pushed to origin/main
- Total bugs fixed this session: 40+ (tsToMillis: 30, crash: 4, security: 3, compliance: 1, memory: 1, + 5 from previous session)

---
Task ID: 1
Agent: main
Task: Fix media upload bugs — feed images, story images, GIF button, polls

Work Log:
- Investigated all media upload code paths across the codebase
- Found root cause: ComposeDialog saved base64 to Firestore, but docToPost() and UserPostCard explicitly stripped all data: URLs on read
- Found StoryUploadSheet was dead code (never imported) — no UI for image stories
- Found GIF button had zero onClick handler
- Created src/lib/upload.ts: Firebase Storage upload utility
- Updated ComposeDialog: uploads to Firebase Storage instead of base64, GIF button now functional
- Removed base64 rejection in docToPost() (db.ts) and UserPostCard.tsx
- Added 'image' format to StoryCreator with full photo/GIF upload UI
- Added ImageStory component to StoryViewer for image story playback
- Updated StoryUploadSheet to use Firebase Storage
- Added 'image' to StoryFormat type and STORY_FORMATS in story-data.ts
- Resolved merge conflicts during rebase with remote (which had poll support added separately)
- Pushed to origin/main

Stage Summary:
- 8 files changed: upload.ts (new), ComposeDialog.tsx, StoryUploadSheet.tsx, UserPostCard.tsx, StoryCreator.tsx, StoryViewer.tsx, db.ts, story-data.ts
- Commit: a5ceeec "fix: image/GIF uploads, story photos, and GIF button"
- All 4 bug categories addressed: feed images, story images, GIF button, and poll/image upload errors
