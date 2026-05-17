---
Task ID: 1
Agent: Main Agent
Task: Fix ProfileEditScreen save bug, simplify CreatePostScreen, fix feed image display

Work Log:
- Located correct RN project at /home/z/black94-app/ (git remote: black94-app)
- Read and audited EditProfileScreen.tsx, CreatePostScreen.tsx, FeedScreen.tsx, api.ts, firebase.ts, app store, imageUpload.ts
- Identified 5 critical bugs and fixed all of them
- Pushed to main to trigger EAS build

Stage Summary:
- **EditProfileScreen**: Fixed critical stale closure bug (handleSave/performSave), fixed useLayoutEffect deps
- **CreatePostScreen**: Complete rewrite — clean simple UI, new icons, upload progress, error alerts
- **FeedScreen**: Added useFocusEffect to reload feed on screen focus (fixes images not showing)
- **No "coming soon" text found** in the project
- Commit: 38e465c pushed to origin/main
