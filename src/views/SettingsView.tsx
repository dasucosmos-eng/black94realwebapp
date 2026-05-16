'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { updateUser, checkUsernameAvailability, updateUsername, getUser, updateAuthorDataInPosts } from '@/lib/db'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'
import { toast } from 'sonner'

/* ═══════════════════════════════════════════════════════════════════════════
   EDIT PROFILE VIEW — Profile editing with real-time username check,
   image upload, and save confirmation
   ═══════════════════════════════════════════════════════════════════════════ */

function compressImage(file: File, maxSize = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > height) {
          if (width > maxSize) { height = (height * maxSize) / width; width = maxSize }
        } else {
          if (height > maxSize) { width = (width * maxSize) / height; height = maxSize }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function compressBanner(file: File, maxW = 1500, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const maxH = 400
        if (width > maxW) { height = (height * maxW) / width; width = maxW }
        if (height > maxH) { width = (width * maxH) / height; height = maxH }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function SettingsView() {
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)
  const navigate = useAppStore((s) => s.navigate)

  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [username, setUsername] = useState(user?.username || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [website, setWebsite] = useState(user?.website || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [uploadingProfile, setUploadingProfile] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)

  // Username availability states
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'current'>('current')
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  // Actual username check function (not memoized — always uses latest closure)
  const doUsernameCheck = async (val: string) => {
    const trimmed = val.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!trimmed || trimmed.length < 3) {
      if (mountedRef.current) setUsernameStatus('invalid')
      return
    }
    // Allow current username
    if (user && trimmed === user.username?.toLowerCase()) {
      if (mountedRef.current) setUsernameStatus('current')
      return
    }
    if (mountedRef.current) setUsernameStatus('checking')
    try {
      const available = await checkUsernameAvailability(trimmed, user?.id)
      if (mountedRef.current) setUsernameStatus(available ? 'available' : 'taken')
    } catch (err) {
      console.error('[Settings] Username check error:', err)
      if (mountedRef.current) setUsernameStatus('idle')
    }
  }

  const handleUsernameChange = (val: string) => {
    const cleaned = val.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
    setUsername(cleaned)
    // Clear previous timer
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current)
    // Set debounce timer
    if (cleaned.length >= 3) {
      usernameTimerRef.current = setTimeout(() => doUsernameCheck(cleaned), 600)
    } else if (cleaned.length > 0) {
      setUsernameStatus('invalid')
    } else {
      setUsernameStatus('idle')
    }
  }

  // Also check on blur (final check when user leaves the field)
  const handleUsernameBlur = () => {
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current)
    if (username.length >= 3) {
      doUsernameCheck(username)
    }
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current) }
  }, [])

  const profileInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingProfile(true)
    try {
      const base64 = await compressImage(file, 400, 0.8)
      setProfilePreview(base64)
      await updateUser(user.id, { profileImage: base64 })
      const updatedUser = { ...user, profileImage: base64 }
      setUser(updatedUser)
      // Batch-update all posts with new avatar
      updateAuthorDataInPosts(user.id, { authorProfileImage: base64 }).catch(() => {})
      toast.success('Profile photo updated')
    } catch {
      toast.error('Failed to upload photo')
    } finally {
      setUploadingProfile(false)
      if (profileInputRef.current) profileInputRef.current.value = ''
    }
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingBanner(true)
    try {
      const base64 = await compressBanner(file, 1200, 0.75)
      setBannerPreview(base64)
      await updateUser(user.id, { coverImage: base64 })
      setUser({ ...user, coverImage: base64 })
      toast.success('Banner updated')
    } catch {
      toast.error('Failed to upload banner')
    } finally {
      setUploadingBanner(false)
      if (bannerInputRef.current) bannerInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!user || saving) return

    // Validate username
    const trimmed = username.trim().toLowerCase()
    if (trimmed && trimmed.length >= 3 && trimmed !== user.username?.toLowerCase()) {
      if (usernameStatus === 'taken') {
        toast.error('This username is already taken')
        return
      }
      if (usernameStatus === 'invalid') {
        toast.error('Username must be at least 3 characters (letters, numbers, underscores)')
        return
      }
    }

    setSaving(true)
    setSaved(false)
    try {
      // Save display name, bio, website
      await updateUser(user.id, { displayName, bio })

      // Save username if changed
      if (trimmed && trimmed.length >= 3 && trimmed !== user.username?.toLowerCase()) {
        await updateUsername(user.id, trimmed)
      }

      // Refresh user from Firestore for accurate data
      const freshUser = await getUser(user.id)
      if (freshUser) {
        const updatedUser = {
          ...user,
          displayName: freshUser.displayName,
          username: freshUser.username,
          bio: freshUser.bio,
          profileImage: profilePreview || freshUser.profileImage,
          coverImage: bannerPreview || freshUser.coverImage,
          isVerified: freshUser.isVerified,
          badge: freshUser.badge,
        }
        setUser(updatedUser)

        // CRITICAL: Batch-update ALL posts by this user with latest profile data
        // This ensures feed/profile consistency — avatar, badge, name always match
        // (same pattern used by major platforms — fan-out on profile write)
        updateAuthorDataInPosts(user.id, {
          authorProfileImage: updatedUser.profileImage,
          authorIsVerified: updatedUser.isVerified,
          authorBadge: updatedUser.badge,
          authorDisplayName: updatedUser.displayName,
          authorUsername: updatedUser.username,
        }).catch((err) => {
          // Non-blocking — posts will still be enriched client-side
          console.warn('[Settings] Background post update failed:', err)
        })
      }

      // Show saved confirmation
      setSaved(true)
      toast.success('Profile updated successfully')

      // Navigate back after short delay to show the confirmation
      setTimeout(() => {
        if (mountedRef.current) navigate('profile')
      }, 800)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const displayProfileImage = profilePreview || user?.profileImage || ''
  const displayBanner = bannerPreview || user?.coverImage || ''

  const usernameStatusColor: Record<string, string> = {
    idle: 'text-[#64748b]',
    checking: 'text-[#71767b]',
    available: 'text-[#10b981]',
    taken: 'text-red-400',
    invalid: 'text-[#71767b]',
    current: 'text-[#64748b]',
  }
  const usernameStatusText: Record<string, string> = {
    idle: '',
    checking: 'Checking availability...',
    available: 'This username is available',
    taken: 'This username is already taken',
    invalid: 'Min 3 characters (a-z, 0-9, _)',
    current: 'This is your current username',
  }
  const usernameBorderClass: Record<string, string> = {
    idle: 'border-white/[0.08] focus-within:border-[#FFFFFF]/50',
    checking: 'border-white/[0.08] focus-within:border-[#FFFFFF]/50',
    available: 'border-[#10b981]/40 focus-within:border-[#10b981]/70',
    taken: 'border-red-400/40 focus-within:border-red-400/70',
    invalid: 'border-white/[0.08] focus-within:border-[#FFFFFF]/50',
    current: 'border-white/[0.08] focus-within:border-[#FFFFFF]/50',
  }

  return (
    <div className="px-4 pt-2 pb-24 space-y-5">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('feed')} className="p-2 -ml-2 rounded-full hover:bg-white/[0.06] transition-colors">
          <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h1 className="text-xl font-bold text-[#e7e9ea]">Edit Profile</h1>
      </div>

      {/* ─── Banner ─── */}
      <div
        className="relative w-full h-[120px] rounded-2xl overflow-hidden bg-white/[0.04] cursor-pointer group"
        onClick={() => bannerInputRef.current?.click()}
      >
        {displayBanner ? (
          <img src={displayBanner} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <svg className="w-8 h-8 text-[#536471] group-hover:text-[#71767b] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className="text-[12px] text-[#536471] group-hover:text-[#71767b] transition-colors">Add banner</span>
          </div>
        )}
        {uploadingBanner && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          {!uploadingBanner && (
            <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
          )}
        </div>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleBannerUpload}
        />
      </div>

      {/* ─── Profile Avatar ─── */}
      <div className="flex items-center gap-4 -mt-8 relative z-10">
        <div className="relative">
          <PAvatar src={displayProfileImage} name={user?.displayName} size={80} className="ring-4 ring-black" />
          <button
            onClick={() => profileInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#3b82f6] flex items-center justify-center shadow-lg hover:bg-[#2563eb] transition-colors"
            disabled={uploadingProfile}
          >
            {uploadingProfile ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            )}
          </button>
          <input
            ref={profileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleProfileUpload}
          />
        </div>
        <div>
          <p className="font-bold text-[15px] text-[#e7e9ea] flex items-center gap-1">
            {user?.displayName}
            {(user?.isVerified || !!user?.badge) && <VerifiedBadge size={14} badge={user?.badge} />}
          </p>
          <p className="text-[14px] text-[#94a3b8]">@{user?.username}</p>
          <button
            onClick={() => profileInputRef.current?.click()}
            className="mt-2 text-[14px] text-[#3b82f6] font-semibold hover:text-[#2563eb] transition-colors"
            disabled={uploadingProfile}
          >
            {uploadingProfile ? 'Uploading...' : 'Change photo'}
          </button>
        </div>
      </div>

      {/* ─── Form Fields ─── */}
      <div className="space-y-4">
        {/* Display Name */}
        <div className="space-y-1.5">
          <label className="text-[14px] text-[#94a3b8] font-medium">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-transparent border border-white/[0.08] rounded-xl px-4 py-3 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
            placeholder="Your display name"
          />
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-[14px] text-[#94a3b8] font-medium">Username</label>
          <div className={cn(
            'flex items-center bg-transparent border rounded-xl px-4 py-3 transition-colors',
            usernameBorderClass[usernameStatus]
          )}>
            <span className="text-[15px] text-[#64748b] mr-1">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              onBlur={handleUsernameBlur}
              className="flex-1 bg-transparent text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none"
              placeholder="username"
            />
            {usernameStatus === 'available' && (
              <svg className="w-[18px] h-[18px] text-[#10b981] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {usernameStatus === 'taken' && (
              <svg className="w-[18px] h-[18px] text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            {usernameStatus === 'current' && (
              <svg className="w-[18px] h-[18px] text-[#64748b] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            )}
            {usernameStatus === 'checking' && (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin shrink-0" />
            )}
          </div>
          {usernameStatusText[usernameStatus] && (
            <p className={cn('text-[12px]', usernameStatusColor[usernameStatus])}>
              {usernameStatusText[usernameStatus]}
            </p>
          )}
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <label className="text-[14px] text-[#94a3b8] font-medium">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            className="w-full bg-transparent border border-white/[0.08] rounded-xl px-4 py-3 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors resize-none"
            placeholder="Tell us about yourself"
          />
          <p className="text-[13px] text-[#94a3b8] text-right">{bio.length}/160</p>
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <label className="text-[14px] text-[#94a3b8] font-medium">Website</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full bg-transparent border border-white/[0.08] rounded-xl px-4 py-3 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
            placeholder="https://yourwebsite.com"
          />
        </div>
      </div>

      {/* ─── Save Button ─── */}
      <button
        onClick={handleSave}
        disabled={saving || saved || usernameStatus === 'taken' || usernameStatus === 'checking'}
        className={cn(
          'w-full py-3 rounded-full text-[15px] font-bold transition-all flex items-center justify-center gap-2',
          saved && 'bg-[#10b981] text-white',
          !saved && saving && 'bg-white/[0.08] text-[#64748b]',
          !saved && !saving && usernameStatus !== 'taken' && usernameStatus !== 'checking' && 'bg-[#e7e9ea] text-black hover:bg-gray-200 active:scale-[0.98]',
          !saved && !saving && (usernameStatus === 'taken' || usernameStatus === 'checking') && 'bg-white/[0.08] text-[#64748b]'
        )}
      >
        {saved && (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Saved
          </>
        )}
        {!saved && saving && (
          <>
            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            Saving...
          </>
        )}
        {!saved && !saving && (usernameStatus === 'taken' || usernameStatus === 'checking')
          ? 'Fix username to save'
          : !saved && !saving && 'Save changes'
        }
      </button>
    </div>
  )
}
