---
Task ID: 1
Agent: Main Agent
Task: Fix offline username bug, post composer (images/GIFs/polls), delete stories mocks

Work Log:
- Read all critical files: app.ts (store), firebase.ts, db.ts, social.ts, page.tsx, ComposeDialog.tsx, StoriesView.tsx, StoryFeed.tsx, StoryCreator.tsx, SettingsView.tsx, story-data.ts, FeedView.tsx, UserPostCard.tsx
- Analyzed screenshot showing offline sidebar with "das / @das"
- Identified root cause of offline bug: setUser() in Zustand store did NOT persist to localStorage, so profile changes (avatar, name, etc.) were lost on offline reload
- Identified root cause of image upload bug: ComposeDialog stored base64 data URLs in Firestore, but docToPost() explicitly rejected base64 URLs (lines 179, 184), making uploaded images invisible
- Identified GIF button as dead (no onClick handler)
- Identified polls as completely unimplemented in ComposeDialog
- Verified stories page has no mock data (all loaded from Firestore)

Stage Summary:
- Fixed offline bug: Modified setUser() in app.ts to always persist user data to localStorage (black94_user_cache)
- Fixed logout: Now also clears black94_user_cache
- Fixed image upload: Rewrote ComposeDialog to upload images to Firebase Storage instead of embedding base64 data URLs. Images are compressed client-side then uploaded as JPEG blobs. Download URLs are stored in Firestore (not base64).
- Fixed GIF support: GIF button now opens a file picker (accept=image/gif). GIFs are uploaded directly without compression (preserves animation). Shows "GIF" badge on preview.
- Added poll support: New poll mode with toggle button, question input, 2-4 options, add/remove options, duration selector. Poll data is serialized as JSON in the caption field.
- Verified no mock data exists in stories (already clean)
- Build passes with zero errors

