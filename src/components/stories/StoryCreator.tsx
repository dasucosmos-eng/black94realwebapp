'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { LANGUAGES, FESTIVAL_TEMPLATES, type StoryFormat, type Language, type StoryAudience, type StoryExpiry, type StoryCard, type PollOption, type FestivalTemplate } from '@/lib/story-data'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app'
import { createStory } from '@/lib/db'
import { storage } from '@/lib/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StoryCreatorProps {
  open: boolean
  onClose: () => void
  onStoryPublished: (story: StoryCard) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FORMAT_OPTIONS: { value: StoryFormat; icon: string; label: string; desc: string }[] = [
  { value: 'text', icon: '✍️', label: 'Text', desc: 'Share your opinion' },
  { value: 'voice', icon: '🎙️', label: 'Voice', desc: 'Record up to 60s' },
  { value: 'thread', icon: '🧵', label: 'Thread', desc: 'Import your threads' },
  { value: 'poll', icon: '📊', label: 'Poll', desc: 'Ask your audience' },
  { value: 'festival', icon: '🎉', label: 'Festival', desc: 'Celebration cards' },
  { value: 'cricket', icon: '🏏', label: 'Cricket', desc: 'Live match updates' },
  { value: 'feed', icon: '📰', label: 'Feed', desc: 'Share a post URL' },
]

const GRADIENT_COLORS = [
  'linear-gradient(135deg, #7B1FA2 0%, #1565C0 100%)',
  'linear-gradient(135deg, #D32F2F 0%, #FF6F00 100%)',
  'linear-gradient(135deg, #2E7D32 0%, #00897B 100%)',
  'linear-gradient(135deg, #C2185B 0%, #7B1FA2 100%)',
  'linear-gradient(135deg, #F57F17 0%, #795548 100%)',
  'linear-gradient(135deg, #0D47A1 0%, #1A237E 100%)',
  'linear-gradient(135deg, #212121 0%, #424242 100%)',
  'linear-gradient(135deg, #FAFAFA 0%, #E0E0E0 100%)',
]

const AUDIENCE_OPTIONS: { value: StoryAudience; label: string; icon: string }[] = [
  { value: 'everyone', label: 'Everyone', icon: '🌐' },
  { value: 'followers', label: 'Followers only', icon: '👥' },
  { value: 'close_friends', label: 'Close friends', icon: '🔒' },
  { value: 'subscribers', label: 'Subscribers only', icon: '⭐' },
]

const EXPIRY_OPTIONS: { value: StoryExpiry; label: string }[] = [
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' },
  { value: '72h', label: '72 hours' },
  { value: 'permanent', label: 'Permanent' },
]

const REGION_OPTIONS = [
  { value: 'all_india', label: 'All India' },
  { value: 'state', label: 'My state' },
  { value: 'city', label: 'My city' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StoryCreator({ open, onClose, onStoryPublished }: StoryCreatorProps) {
  // ---- State ----
  const [format, setFormat] = useState<StoryFormat>('text')
  const [language, setLanguage] = useState<Language>('en')
  const [audience, setAudience] = useState<StoryAudience>('everyone')
  const [expiry, setExpiry] = useState<StoryExpiry>('24h')
  const [region, setRegion] = useState('all_india')
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)

  // Collapsible dropdown toggles
  const [audienceOpen, setAudienceOpen] = useState(false)
  const [expiryOpen, setExpiryOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)

  // Text format state
  const [textContent, setTextContent] = useState('')
  const [textGradient, setTextGradient] = useState(GRADIENT_COLORS[0])
  const [textFontSize, setTextFontSize] = useState<'S' | 'M' | 'L'>('M')
  const [textPollEnabled, setTextPollEnabled] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: 'opt_1', text: '', votes: 0, percentage: 0 },
    { id: 'opt_2', text: '', votes: 0, percentage: 0 },
  ])

  // Voice format state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [voiceWaveform, setVoiceWaveform] = useState<number[]>([])
  const [autoCaption, setAutoCaption] = useState(true)
  const [voiceCaptionLang, setVoiceCaptionLang] = useState<Language>('en')
  const [hasRecorded, setHasRecorded] = useState(false)
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveformInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioBlobRef = useRef<Blob | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const user = useAppStore((s) => s.user)

  // ---- Voice helpers (defined early to avoid TDZ in useEffect) ----

  const stopRecording = useCallback((): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        const recorder = mediaRecorderRef.current
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          audioBlobRef.current = blob
          setHasRecorded(true)
          // Clean up AFTER recorder fully stopped
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop())
            streamRef.current = null
          }
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close()
            audioContextRef.current = null
          }
          analyserRef.current = null
          setIsRecording(false)
          resolve()
        }
        recorder.stop()
      } else {
        // Not recording, just clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
        analyserRef.current = null
        setIsRecording(false)
        resolve()
      }
    })
  }, [])

  // Keep a stable ref so the useEffect timer can call stop without TDZ
  const stopRecordingRef = useRef(stopRecording)
  stopRecordingRef.current = stopRecording

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 128
      source.connect(analyser)
      analyserRef.current = analyser

      audioChunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.start(1000)
      setIsRecording(true)
      setRecordingTime(0)
      setHasRecorded(false)
      setVoiceWaveform([])
    } catch (err) {
      console.error('Microphone access denied:', err)
      toast.error('Microphone access denied. Please allow microphone permission.')
    }
  }, [isRecording, stopRecording])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // Thread format state
  const [threadTitle, setThreadTitle] = useState('')
  const [threadCards, setThreadCards] = useState<string[]>([])
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null)
  const [editingCardText, setEditingCardText] = useState('')

  // Poll format state (standalone)
  const [standalonePollQuestion, setStandalonePollQuestion] = useState('')
  const [standalonePollOptions, setStandalonePollOptions] = useState<PollOption[]>([
    { id: 'sp_1', text: '', votes: 0, percentage: 25 },
    { id: 'sp_2', text: '', votes: 0, percentage: 25 },
    { id: 'sp_3', text: '', votes: 0, percentage: 25 },
    { id: 'sp_4', text: '', votes: 0, percentage: 25 },
  ])
  const [pollReactionEmojis, setPollReactionEmojis] = useState<string[]>(['👍', '🔥', '💯', '😱'])

  // Festival format state
  const [selectedFestival, setSelectedFestival] = useState<FestivalTemplate | null>(null)
  const [festivalMessage, setFestivalMessage] = useState('')

  // Cricket format state
  const [cricketTeam1, setCricketTeam1] = useState('')
  const [cricketTeam2, setCricketTeam2] = useState('')
  const [cricketTeam1Score, setCricketTeam1Score] = useState('')
  const [cricketTeam2Score, setCricketTeam2Score] = useState('')
  const [cricketOvers, setCricketOvers] = useState('')
  const [cricketVenue, setCricketVenue] = useState('')
  const [cricketStatus, setCricketStatus] = useState<'live' | 'completed' | 'upcoming'>('live')
  const [cricketCommentary, setCricketCommentary] = useState('')

  // Feed format state
  const [feedUrl, setFeedUrl] = useState('')
  const [feedCaption, setFeedCaption] = useState('')

  // ---- Poll preview (shows equal distribution before voting) ----
  const previewPercentages = useMemo(() => {
    const filled = standalonePollOptions.filter((o) => o.text.trim()).length
    if (filled === 0) return standalonePollOptions.map(() => 0)
    const each = Math.floor(100 / filled)
    const remainder = 100 - each * filled
    return standalonePollOptions.map((o, i) =>
      o.text.trim() ? each + (i < remainder ? 1 : 0) : 0
    )
  }, [standalonePollOptions])

  // ---- Effects ----

  // Recording timer + real waveform from analyser
  useEffect(() => {
    if (isRecording) {
      recordingInterval.current = setInterval(() => {
        setRecordingTime((t) => {
          if (t >= 60) {
            stopRecordingRef.current()
            return 60
          }
          return t + 1
        })
      }, 1000)
      // Real waveform from audio analyser
      waveformInterval.current = setInterval(() => {
        if (analyserRef.current) {
          const data = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(data)
          const bars: number[] = []
          const step = Math.floor(data.length / 20)
          for (let i = 0; i < 20; i++) {
            bars.push(data[i * step] || 0)
          }
          setVoiceWaveform(bars)
        }
      }, 100)
    } else {
      if (recordingInterval.current) clearInterval(recordingInterval.current)
      if (waveformInterval.current) clearInterval(waveformInterval.current)
    }
    return () => {
      if (recordingInterval.current) clearInterval(recordingInterval.current)
      if (waveformInterval.current) clearInterval(waveformInterval.current)
    }
  }, [isRecording])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setFormat('text')
      setLanguage('en')
      setAudience('everyone')
      setExpiry('24h')
      setRegion('all_india')
      setPublishing(false)
      setPublished(false)
      setAudienceOpen(false)
      setExpiryOpen(false)
      setLanguageOpen(false)
      setTextContent('')
      setTextGradient(GRADIENT_COLORS[0])
      setTextFontSize('M')
      setTextPollEnabled(false)
      setPollQuestion('')
      setPollOptions([
        { id: 'opt_1', text: '', votes: 0, percentage: 0 },
        { id: 'opt_2', text: '', votes: 0, percentage: 0 },
      ])
      setIsRecording(false)
      setRecordingTime(0)
      setVoiceWaveform([])
      setHasRecorded(false)
      setThreadTitle('')
      setThreadCards([])
      setEditingCardIndex(null)
      setStandalonePollQuestion('')
      setStandalonePollOptions([
        { id: 'sp_1', text: '', votes: 0, percentage: 25 },
        { id: 'sp_2', text: '', votes: 0, percentage: 25 },
        { id: 'sp_3', text: '', votes: 0, percentage: 25 },
        { id: 'sp_4', text: '', votes: 0, percentage: 25 },
      ])
      setSelectedFestival(null)
      setFestivalMessage('')
      setCricketTeam1('')
      setCricketTeam2('')
      setCricketTeam1Score('')
      setCricketTeam2Score('')
      setCricketOvers('')
      setCricketVenue('')
      setCricketStatus('live')
      setCricketCommentary('')
      setFeedUrl('')
      setFeedCaption('')
      // Clean up voice recording refs
      audioBlobRef.current = null
      audioChunksRef.current = []
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      mediaRecorderRef.current = null
      analyserRef.current = null
    }
  }, [open])

  // ---- Content validation ----

  function hasContent(): boolean {
    switch (format) {
      case 'text':
        return textContent.trim().length > 0
      case 'voice':
        return hasRecorded
      case 'thread':
        return threadTitle.trim().length > 0 && threadCards.some((c) => c.trim().length > 0)
      case 'poll':
        return standalonePollQuestion.trim().length > 0 && standalonePollOptions.some((o) => o.text.trim().length > 0)
      case 'festival':
        return selectedFestival !== null && festivalMessage.trim().length > 0
      case 'cricket':
        return cricketTeam1.trim().length > 0 && cricketTeam2.trim().length > 0
      case 'feed':
        return feedUrl.trim().length > 0
      default:
        return false
    }
  }

  // ---- Build story ----

  function buildStory(): StoryCard {
    const id = `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const base: StoryCard = {
      id,
      format: format!,
      content: '',
      language,
    }

    switch (format) {
      case 'text':
        return {
          ...base,
          content: textContent,
          mediaUrl: textGradient,
          pollOptions: textPollEnabled
            ? pollOptions.filter((o) => o.text.trim())
            : undefined,
        }
      case 'voice':
        return {
          ...base,
          content: `Voice story (${recordingTime}s)`,
          voiceWaveform: voiceWaveform.length > 0 ? voiceWaveform : Array.from({ length: 20 }, () => Math.floor(Math.random() * 80 + 20)),
          voiceDuration: recordingTime,
        }
      case 'thread': {
        const numberedCards = threadCards
          .filter((c) => c.trim())
          .map((c, i) => `${i + 1}/${threadCards.filter((cc) => cc.trim()).length} — ${c.trim()}`)
        return {
          ...base,
          content: numberedCards.join('\n---\n'),
        }
      }
      case 'poll':
        return {
          ...base,
          content: standalonePollQuestion,
          pollOptions: standalonePollOptions
            .filter((o) => o.text.trim())
            .map((o) => ({ ...o, percentage: 0, votes: 0 })),
        }
      case 'festival':
        return {
          ...base,
          content: festivalMessage,
          festivalTemplate: selectedFestival,
        }
      case 'cricket':
        return {
          ...base,
          content: cricketCommentary || `${cricketTeam1} vs ${cricketTeam2}`,
          cricketData: {
            team1: cricketTeam1.trim(),
            team2: cricketTeam2.trim(),
            team1Score: cricketTeam1Score.trim() || '0/0',
            team2Score: cricketTeam2Score.trim() || '0/0',
            overs: cricketOvers.trim() || '0.0',
            venue: cricketVenue.trim() || 'TBD',
            status: cricketStatus,
          },
        }
      case 'feed':
        return {
          ...base,
          content: feedCaption || feedUrl,
        }
      default:
        return base
    }
  }

  // ---- Publish (OPTIMISTIC — shows story immediately, syncs to Firestore in background) ----

  const handlePublish = async () => {
    try {
      if (!hasContent()) {
        toast.error('Please add content before publishing')
        return
      }

      if (!user?.id) {
        toast.error('You must be logged in to publish a story')
        return
      }

      setPublishing(true)

      // Build the story card for local display
      const story = buildStory()

      // OPTIMISTIC: Notify parent immediately so story appears in feed
      onStoryPublished(story)

      // Success feedback
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.7 } })
      setPublishing(false)
      setPublished(true)
      toast.success('Story published!')

      // Close creator after a brief delay so user sees the success state
      setTimeout(() => {
        onClose()
      }, 1200)

      // ---- Background sync to Firestore (non-blocking) ----
      try {
        // Upload voice audio to Firebase Storage if needed
        let voiceUrl: string | undefined
        if (format === 'voice') {
          // Ensure the audio blob is ready
          for (let i = 0; i < 20; i++) {
            if (audioBlobRef.current) break
            await new Promise((r) => setTimeout(r, 100))
          }
          if (audioBlobRef.current) {
            try {
              const audioFile = new File([audioBlobRef.current], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
              const audioStoragePath = `stories/${user.id}/${Date.now()}.webm`
              const audioRef = storageRef(storage, audioStoragePath)
              await uploadBytes(audioRef, audioFile)
              voiceUrl = await getDownloadURL(audioRef)
            } catch (audioErr) {
              console.error('Audio upload failed:', audioErr)
            }
          }
        }

        // Save to Firestore with author info from app store (no extra getUser read)
        const firestoreData: Parameters<typeof createStory>[1] = {
          format: format!,
          content: story.content,
          language,
          audience,
          expiry,
        }

        if (format === 'text') {
          firestoreData.mediaUrl = textGradient
          if (story.pollOptions) firestoreData.pollOptions = story.pollOptions
        }
        if (format === 'voice') {
          firestoreData.voiceUrl = voiceUrl
          firestoreData.voiceDuration = recordingTime
          firestoreData.voiceWaveform = story.voiceWaveform
        }
        if (format === 'poll' && story.pollOptions) {
          firestoreData.pollOptions = story.pollOptions
        }
        if (format === 'festival' && story.festivalTemplate) {
          firestoreData.festivalTemplate = story.festivalTemplate as Parameters<typeof createStory>[1]['festivalTemplate']
          firestoreData.mediaUrl = story.festivalTemplate.gradient
        }
        if (format === 'cricket') {
          firestoreData.cricketData = {
            team1: cricketTeam1.trim(),
            team2: cricketTeam2.trim(),
            team1Score: cricketTeam1Score.trim() || '0/0',
            team2Score: cricketTeam2Score.trim() || '0/0',
            overs: cricketOvers.trim() || '0.0',
            venue: cricketVenue.trim() || 'TBD',
            status: cricketStatus,
          }
        }
        if (format === 'feed') {
          firestoreData.mediaUrl = feedUrl
        }

        await createStory(user.id, firestoreData, {
          authorUsername: user.username || 'user',
          authorDisplayName: user.displayName || user.username || 'User',
          authorProfileImage: user.profileImage || '',
          authorIsVerified: user.isVerified || false,
        })
      } catch (firestoreErr) {
        console.error('Background Firestore sync failed (story already shown locally):', firestoreErr)
      }
    } catch (err) {
      console.error('Story publish failed:', err)
      setPublishing(false)
      toast.error('Failed to publish story. Please try again.')
    }
  }

  // ---- Thread helpers ----

  const addThreadCard = useCallback(() => {
    setThreadCards((prev) => [...prev, ''])
  }, [])

  const removeThreadCard = useCallback((index: number) => {
    setThreadCards((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const startEditCard = useCallback((index: number) => {
    setEditingCardIndex(index)
    setEditingCardText(threadCards[index])
  }, [threadCards])

  const saveEditCard = useCallback(() => {
    if (editingCardIndex !== null && editingCardText.trim()) {
      setThreadCards((prev) =>
        prev.map((c, i) => (i === editingCardIndex ? editingCardText.trim() : c)),
      )
      setEditingCardIndex(null)
      setEditingCardText('')
    }
  }, [editingCardIndex, editingCardText])

  // ---- Poll helpers ----

  const addPollOption = useCallback(() => {
    if (standalonePollOptions.length < 4) {
      setStandalonePollOptions((prev) => [
        ...prev,
        { id: `sp_${Date.now()}`, text: '', votes: 0, percentage: 0 },
      ])
    }
  }, [standalonePollOptions.length])

  const removePollOption = useCallback(
    (index: number) => {
      if (standalonePollOptions.length > 2) {
        setStandalonePollOptions((prev) => prev.filter((_, i) => i !== index))
      }
    },
    [standalonePollOptions.length],
  )

  const updatePollOption = useCallback((index: number, text: string) => {
    setStandalonePollOptions((prev) =>
      prev.map((o, i) => (i === index ? { ...o, text } : o)),
    )
  }, [])

  // ---- Text poll helpers (inline) ----

  const addTextPollOption = useCallback(() => {
    if (pollOptions.length < 4) {
      setPollOptions((prev) => [
        ...prev,
        { id: `opt_${Date.now()}`, text: '', votes: 0, percentage: 0 },
      ])
    }
  }, [pollOptions.length])

  const removeTextPollOption = useCallback(
    (index: number) => {
      if (pollOptions.length > 2) {
        setPollOptions((prev) => prev.filter((_, i) => i !== index))
      }
    },
    [pollOptions.length],
  )

  const updateTextPollOption = useCallback((index: number, text: string) => {
    setPollOptions((prev) =>
      prev.map((o, i) => (i === index ? { ...o, text } : o)),
    )
  }, [])

  // ---- Close all dropdowns ----
  const closeDropdowns = useCallback(() => {
    setAudienceOpen(false)
    setExpiryOpen(false)
    setLanguageOpen(false)
  }, [])

  // =========================================================================
  // RENDER HELPERS (plain functions returning JSX — NOT components)
  // This prevents React from unmounting/remounting on every keystroke,
  // which would dismiss the mobile keyboard.
  // =========================================================================

  // ---- TEXT ----
  const renderTextCanvas = () => (
    <div className="pt-2 pb-20 flex flex-col gap-4">
      <div
        className="rounded-2xl p-5 min-h-[200px] flex items-center justify-center relative overflow-hidden"
        style={{ background: textGradient }}
      >
        <textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder="Type your story here..."
          className={cn(
            'w-full bg-transparent text-white placeholder:text-white/30 resize-none outline-none',
            textFontSize === 'S' && 'text-base',
            textFontSize === 'M' && 'text-xl',
            textFontSize === 'L' && 'text-2xl',
          )}
          style={{ fontWeight: 700 }}
          rows={4}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-white/40 text-xs mr-1">Size</span>
        {(['S', 'M', 'L'] as const).map((size) => (
          <motion.button
            key={size}
            whileTap={{ scale: 0.92 }}
            onClick={() => setTextFontSize(size)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border',
              textFontSize === size
                ? 'border-[#00f0ff] bg-[#00f0ff]/15 shadow-[0_0_8px_rgba(0,240,255,0.25)]'
                : 'border-white/[0.08] bg-white/[0.04] text-white/50',
            )}
            style={textFontSize === size ? { color: '#00f0ff', textShadow: '0 0 6px rgba(0,240,255,0.3)' } : undefined}
          >
            {size}
          </motion.button>
        ))}
      </div>

      <div className="flex items-center gap-2.5">
        <span className="text-white/40 text-xs mr-1">BG</span>
        {GRADIENT_COLORS.map((grad, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.9 }}
            onClick={() => setTextGradient(grad)}
            className={cn(
              'w-8 h-8 rounded-full shrink-0 transition-all border-2',
              textGradient === grad
                ? 'border-[#00f0ff] scale-110 shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                : 'border-transparent',
            )}
            style={{ background: grad }}
          />
        ))}
      </div>

      <div className={cn(
        'flex items-center justify-between rounded-xl bg-white/[0.04] border p-3.5 transition-all',
        textPollEnabled ? 'border-[#00f0ff]/30 shadow-[0_0_12px_rgba(0,240,255,0.1)]' : 'border-white/[0.08]',
      )}>
        <div>
          <p className="text-white text-sm font-medium">Add live poll below</p>
          <p className="text-white/30 text-xs">Let viewers vote on options</p>
        </div>
        <button
          onClick={() => setTextPollEnabled(!textPollEnabled)}
          className={cn(
            'w-12 h-7 rounded-full relative transition-colors duration-200',
            textPollEnabled ? 'bg-[#00f0ff]' : 'bg-white/20',
          )}
        >
          <motion.div
            className="absolute top-0.5 w-6 h-6 rounded-full bg-white"
            animate={{ left: textPollEnabled ? 22 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      <AnimatePresence>
        {textPollEnabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 pb-2">
              {pollOptions.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateTextPollOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#00f0ff]/50 transition-colors"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => removeTextPollOption(i)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] text-white/40 hover:text-red-400 transition-colors text-lg"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  onClick={addTextPollOption}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/20"
                >
                  <span className="text-sm">+</span> Add option
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  // ---- VOICE ----
  const renderVoiceCanvas = () => (
    <div className="pt-4 pb-20 flex flex-col items-center gap-6">
      <div className="flex items-center justify-center gap-[3px] h-24 w-full max-w-xs">
        {(voiceWaveform.length > 0
          ? voiceWaveform
          : Array.from({ length: 20 }, () => 8)
        ).map((h, i) => (
          <motion.div
            key={i}
            className="w-[5px] rounded-full"
            style={{
              minHeight: 4,
              height: `${Math.max(4, h)}%`,
              background: isRecording
                ? 'linear-gradient(to top, #00f0ff, #ff00aa)'
                : 'rgba(0,240,255,0.6)',
              boxShadow: isRecording ? '0 0 6px rgba(0,240,255,0.5)' : 'none',
            }}
            animate={{ height: `${Math.max(4, h)}%` }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          />
        ))}
      </div>

      <div className="text-center">
        <p
          className="font-mono text-3xl tabular-nums font-bold tracking-wider"
          style={{ color: '#00f0ff', textShadow: '0 0 12px rgba(0,240,255,0.4)' }}
        >
          {formatTime(recordingTime)}
        </p>
        <p className="text-white/30 text-sm mt-1">/ 01:00</p>
      </div>

      <div className="relative flex items-center justify-center">
        <AnimatePresence>
          {isRecording && (
            <>
              {[0, 1, 2].map((ring) => (
                <motion.div
                  key={ring}
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2.2 + ring * 0.4, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: ring * 0.3, ease: 'easeOut' }}
                  className="absolute w-20 h-20 rounded-full border-2"
                  style={{ borderColor: 'rgba(0,240,255,0.3)' }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleRecording}
          className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 bg-red-500 shadow-red-500/20"
        >
          {isRecording ? (
            <div className="w-6 h-6 rounded-md bg-white" />
          ) : (
            <svg width="28" height="28" fill="white" viewBox="0 0 24 24">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2z" />
            </svg>
          )}
        </motion.button>
      </div>

      <p className="text-white/40 text-sm">
        {isRecording ? 'Tap to stop' : hasRecorded ? 'Tap to re-record' : 'Tap to record'}
      </p>

      {hasRecorded && !isRecording && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 w-full max-w-xs"
        >
          <button
            className="w-12 h-12 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center"
            style={{ color: '#00f0ff' }}
          >
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(to right, #00f0ff, #ff00aa)' }}
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: recordingTime, ease: 'linear' }}
            />
          </div>
        </motion.div>
      )}

      <div className={cn(
        'w-full rounded-xl bg-white/[0.04] border p-4 transition-all',
        autoCaption ? 'border-[#00f0ff]/20' : 'border-white/[0.08]',
      )}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white text-sm font-medium">Auto-caption</p>
            <p className="text-white/30 text-xs">Generate text from your voice</p>
          </div>
          <button
            onClick={() => setAutoCaption(!autoCaption)}
            className={cn(
              'w-12 h-7 rounded-full relative transition-colors duration-200',
              autoCaption ? 'bg-[#00f0ff]' : 'bg-white/20',
            )}
          >
            <motion.div
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white"
              animate={{ left: autoCaption ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
        {autoCaption && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 overflow-x-auto pb-1">
              {LANGUAGES.slice(0, 5).map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setVoiceCaptionLang(lang.code)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                    voiceCaptionLang === lang.code
                      ? 'border-[#00f0ff] bg-[#00f0ff]/15 shadow-[0_0_8px_rgba(0,240,255,0.25)]'
                      : 'border-white/[0.08] bg-white/[0.04] text-white/50',
                  )}
                  style={voiceCaptionLang === lang.code ? { color: '#00f0ff', textShadow: '0 0 6px rgba(0,240,255,0.3)' } : undefined}
                >
                  {lang.flag} {lang.nativeLabel}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )

  // ---- THREAD ----
  const renderThreadCanvas = () => (
    <div className="pt-2 pb-20 flex flex-col gap-4">
      <div>
        <label className="text-white/40 text-xs mb-2 block">Thread Title</label>
        <input
          type="text"
          value={threadTitle}
          onChange={(e) => setThreadTitle(e.target.value)}
          placeholder="Give your thread a title..."
          className="w-full bg-transparent text-white text-xl font-bold placeholder:text-white/20 outline-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-white/60 text-sm font-medium">
          Thread Cards ({threadCards.length})
        </h3>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={addThreadCard}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/20"
        >
          <span className="text-sm">+</span> Add Card
        </motion.button>
      </div>

      {threadCards.length > 0 ? (
        <div className="flex flex-col gap-3">
          {threadCards.map((card, i) => (
            <motion.div
              key={`card-${i}`}
              layout
              className={cn(
                'rounded-2xl bg-white/[0.04] border p-4 transition-colors',
                editingCardIndex === i ? 'border-[#00f0ff]/50 shadow-[0_0_12px_rgba(0,240,255,0.15)]' : 'border-white/[0.08]',
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold" style={{ color: '#00f0ff', textShadow: '0 0 6px rgba(0,240,255,0.3)' }}>
                  Card {i + 1}/{threadCards.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => startEditCard(i)} className="text-white/40 hover:text-[#00f0ff] transition-colors text-xs font-medium">
                    Edit
                  </button>
                  <button onClick={() => removeThreadCard(i)} className="w-6 h-6 flex items-center justify-center rounded-full bg-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs">
                    ×
                  </button>
                </div>
              </div>

              {editingCardIndex === i ? (
                <>
                  <textarea
                    value={editingCardText}
                    onChange={(e) => setEditingCardText(e.target.value)}
                    className="w-full bg-white/[0.06] rounded-lg p-2.5 text-sm text-white outline-none resize-none border border-[#00f0ff]/30 focus:border-[#00f0ff]/60"
                    rows={4}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={saveEditCard}
                      className="flex-1 py-1.5 rounded-lg text-white text-xs font-medium"
                      style={{ background: 'linear-gradient(135deg, #00f0ff 0%, #00b8d4 100%)' }}
                    >
                      Save
                    </button>
                    <button onClick={() => setEditingCardIndex(null)} className="flex-1 py-1.5 rounded-lg bg-white/[0.06] text-white/60 text-xs font-medium">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-white/70 text-sm leading-relaxed">{card || 'Empty card — tap Edit to add content'}</p>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="text-4xl mb-3">🧵</span>
          <p className="text-white/40 text-sm">Start building your thread</p>
          <p className="text-white/25 text-xs mt-1">Add cards to create a multi-slide story</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={addThreadCard}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/20"
          >
            <span className="text-base">+</span> Add First Card
          </motion.button>
        </div>
      )}

      {threadCards.length > 0 && (
        <p className="text-white/30 text-xs text-center">
          Each card becomes one story slide · {threadCards.filter((c) => c.trim()).length} card{threadCards.filter((c) => c.trim()).length !== 1 ? 's' : ''} with content
        </p>
      )}
    </div>
  )

  // ---- POLL ----
  const renderPollCanvas = () => (
    <div className="pt-2 pb-20 flex flex-col gap-5">
      <input
        type="text"
        value={standalonePollQuestion}
        onChange={(e) => setStandalonePollQuestion(e.target.value)}
        placeholder="Ask a question..."
        className="w-full bg-transparent text-white text-xl font-bold placeholder:text-white/20 outline-none"
      />

      <div className="flex flex-col gap-2.5">
        {standalonePollOptions.map((opt, i) => (
          <div key={opt.id} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={opt.text}
                onChange={(e) => updatePollOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#00f0ff]/50 transition-colors"
              />
              {opt.text.trim() && (
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: `${previewPercentages[i] || 0}%` }}
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{ background: 'rgba(0,240,255,0.1)' }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              )}
            </div>
            <span className="text-white/30 text-xs w-10 text-right tabular-nums">
              {opt.text.trim() ? `${previewPercentages[i]}%` : ''}
            </span>
            {standalonePollOptions.length > 2 && (
              <button onClick={() => removePollOption(i)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] text-white/40 hover:text-red-400 transition-colors text-lg">
                ×
              </button>
            )}
          </div>
        ))}
        {standalonePollOptions.length < 4 && (
          <button onClick={addPollOption} className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/20">
            <span className="text-sm">+</span> Add option
          </button>
        )}
      </div>

      <div>
        <p className="text-white/30 text-xs mb-2">Reaction emojis</p>
        <div className="flex gap-2">
          {pollReactionEmojis.map((emoji, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.85 }}
              onClick={() => setPollReactionEmojis((prev) => prev.filter((_, idx) => idx !== i))}
              className="w-10 h-10 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-lg hover:border-[#00f0ff]/30 transition-colors"
            >
              {emoji}
            </motion.button>
          ))}
          <button
            onClick={() => {
              const emojis = ['😂', '❤️', '🤔', '😤', '🙌', '💯', '🎉', '😢', '🤩', '👏']
              const random = emojis[Math.floor(Math.random() * emojis.length)]
              if (pollReactionEmojis.length < 8) setPollReactionEmojis((prev) => [...prev, random])
            }}
            className="w-10 h-10 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center text-lg font-bold hover:bg-[#00f0ff]/20 transition-colors"
            style={{ color: '#00f0ff' }}
          >
            +
          </button>
        </div>
      </div>

      {standalonePollQuestion.trim() && standalonePollOptions.some((o) => o.text.trim()) && (
        <div className="rounded-2xl bg-white/[0.04] border border-[#00f0ff]/20 p-5">
          <p className="text-white/30 text-xs mb-3 font-medium uppercase tracking-wider">Live Preview</p>
          <p className="text-white font-bold text-base mb-4">{standalonePollQuestion || 'Your question here'}</p>
          <div className="flex flex-col gap-2">
            {standalonePollOptions.filter((o) => o.text.trim()).map((opt) => {
              const pct = previewPercentages[standalonePollOptions.indexOf(opt)] || 0
              return (
                <div key={opt.id} className="relative">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: standalonePollOptions.indexOf(opt) * 0.1 }}
                    className="absolute inset-0 rounded-xl"
                    style={{ background: 'rgba(0,240,255,0.15)' }}
                  />
                  <div className="relative flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <span className="text-white text-sm">{opt.text}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: '#00f0ff', textShadow: '0 0 6px rgba(0,240,255,0.3)' }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  // ---- FESTIVAL ----
  const renderFestivalCanvas = () => (
    <div className="pt-2 pb-20 flex flex-col gap-4">
      {!selectedFestival ? (
        <>
          <h3 className="text-lg font-bold text-white">Festival Templates</h3>
          <p className="text-white/40 text-sm">Choose a template and add your message</p>
          <div className="grid grid-cols-2 gap-3 mt-1">
            {FESTIVAL_TEMPLATES.map((tpl, i) => (
              <motion.button
                key={tpl.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedFestival(tpl)}
                className="relative rounded-2xl overflow-hidden aspect-[3/4] flex flex-col items-center justify-end p-4 hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-shadow border border-transparent hover:border-[#00f0ff]/30"
              >
                <span className="text-5xl mb-3 drop-shadow-lg">{tpl.emoji}</span>
                <span className="font-bold text-sm drop-shadow-md" style={{ color: tpl.textColor }}>{tpl.name}</span>
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Customise Card</h3>
            <button onClick={() => { setSelectedFestival(null); setFestivalMessage('') }} className="text-white/40 text-xs hover:text-[#00f0ff] transition-colors">
              Change template
            </button>
          </div>
          <div
            className="relative rounded-2xl overflow-hidden aspect-[3/4] flex flex-col items-center justify-end p-6 border border-[#00f0ff]/20"
            style={{ background: selectedFestival.gradient }}
          >
            <span className="text-6xl mb-4 drop-shadow-lg">{selectedFestival.emoji}</span>
            <textarea
              value={festivalMessage}
              onChange={(e) => setFestivalMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full bg-transparent text-center text-white placeholder:text-white/40 outline-none resize-none font-bold text-lg drop-shadow-md"
              style={{ color: selectedFestival.textColor }}
              rows={3}
              autoFocus
            />
            <p className="text-xs mt-3 font-medium drop-shadow-sm opacity-60" style={{ color: selectedFestival.textColor }}>
              {selectedFestival.name} Greetings
            </p>
          </div>
        </>
      )}
    </div>
  )

  // ---- CRICKET ----
  const renderCricketCanvas = () => (
    <div className="pt-2 pb-20 flex flex-col gap-4">
      <h3 className="text-lg font-bold text-white">Match Details</h3>
      <p className="text-white/40 text-sm">Enter the match info to create a cricket story</p>

      {/* Status toggle */}
      <div className="flex items-center gap-2">
        {(['live', 'upcoming', 'completed'] as const).map((s) => (
          <motion.button
            key={s}
            whileTap={{ scale: 0.92 }}
            onClick={() => setCricketStatus(s)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border',
              cricketStatus === s
                ? s === 'live'
                  ? 'border-red-400 bg-red-500/15 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.25)]'
                  : s === 'upcoming'
                    ? 'border-yellow-400 bg-yellow-500/15 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.25)]'
                    : 'border-green-400 bg-green-500/15 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.25)]'
                : 'border-white/[0.08] bg-white/[0.04] text-white/50',
            )}
          >
            {s === 'live' && '🔴 '}
            {s === 'upcoming' && '🟡 '}
            {s === 'completed' && '🟢 '}
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </motion.button>
        ))}
      </div>

      {/* Teams */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <label className="text-white/30 text-xs mb-1 block">Team 1</label>
            <input
              type="text"
              value={cricketTeam1}
              onChange={(e) => setCricketTeam1(e.target.value.toUpperCase())}
              placeholder="IND"
              maxLength={5}
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-white font-bold text-lg placeholder:text-white/20 outline-none focus:border-[#00f0ff]/50 transition-colors"
            />
          </div>
          <span className="text-white/20 text-xs font-bold px-3 mt-4">VS</span>
          <div className="flex-1">
            <label className="text-white/30 text-xs mb-1 block text-right">Team 2</label>
            <input
              type="text"
              value={cricketTeam2}
              onChange={(e) => setCricketTeam2(e.target.value.toUpperCase())}
              placeholder="AUS"
              maxLength={5}
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-white font-bold text-lg placeholder:text-white/20 outline-none focus:border-[#00f0ff]/50 transition-colors text-right"
            />
          </div>
        </div>

        {/* Scores */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex-1">
            <label className="text-white/30 text-xs mb-1 block">Score</label>
            <input
              type="text"
              value={cricketTeam1Score}
              onChange={(e) => setCricketTeam1Score(e.target.value)}
              placeholder="287/4"
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono text-sm placeholder:text-white/20 outline-none focus:border-[#00f0ff]/50 transition-colors"
            />
          </div>
          <div className="flex-1">
            <label className="text-white/30 text-xs mb-1 block text-right">Score</label>
            <input
              type="text"
              value={cricketTeam2Score}
              onChange={(e) => setCricketTeam2Score(e.target.value)}
              placeholder="265"
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono text-sm placeholder:text-white/20 outline-none focus:border-[#00f0ff]/50 transition-colors text-right"
            />
          </div>
        </div>

        {/* Overs + Venue */}
        <div className="flex items-end gap-3">
          <div className="w-24">
            <label className="text-white/30 text-xs mb-1 block">Overs</label>
            <input
              type="text"
              value={cricketOvers}
              onChange={(e) => setCricketOvers(e.target.value)}
              placeholder="42.3"
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono text-sm placeholder:text-white/20 outline-none focus:border-[#00f0ff]/50 transition-colors"
            />
          </div>
          <div className="flex-1">
            <label className="text-white/30 text-xs mb-1 block">Venue</label>
            <input
              type="text"
              value={cricketVenue}
              onChange={(e) => setCricketVenue(e.target.value)}
              placeholder="Eden Gardens, Kolkata"
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#00f0ff]/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Commentary */}
      <div>
        <label className="text-white/40 text-xs mb-2 block">Your take (optional)</label>
        <textarea
          value={cricketCommentary}
          onChange={(e) => setCricketCommentary(e.target.value)}
          placeholder="What do you think about this match?"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none resize-none text-sm focus:border-[#00f0ff]/50 transition-colors"
          rows={3}
        />
      </div>

      {/* Preview */}
      {cricketTeam1.trim() && cricketTeam2.trim() && (
        <div className="rounded-2xl overflow-hidden border border-[#00f0ff]/15">
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-5 flex flex-col items-center justify-center min-h-[180px]">
            {cricketStatus === 'live' && (
              <div className="flex items-center gap-1.5 mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="text-xs font-bold text-red-400 tracking-wider">LIVE</span>
              </div>
            )}
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center">
                <p className="text-white font-bold text-sm">{cricketTeam1}</p>
                <p className="font-mono text-lg font-bold" style={{ color: '#00f0ff', textShadow: '0 0 8px rgba(0,240,255,0.4)' }}>{cricketTeam1Score || '0/0'}</p>
              </div>
              <div>
                <p className="text-white/30 text-[10px]">vs</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-sm">{cricketTeam2}</p>
                <p className="text-white/60 font-mono text-lg">{cricketTeam2Score || '0/0'}</p>
              </div>
            </div>
            <div className="w-16 h-[1px] bg-[#00f0ff]/20 mb-3" />
            {cricketVenue && <p className="text-white/30 text-xs">{cricketVenue} · {cricketOvers || '0.0'} ov</p>}
            {cricketCommentary.trim() && (
              <p className="text-white text-sm text-center font-medium leading-relaxed px-2 mt-2">&ldquo;{cricketCommentary}&rdquo;</p>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // ---- FEED ----
  const renderFeedCanvas = () => (
    <div className="pt-4 pb-20 flex flex-col gap-5">
      <h3 className="text-lg font-bold text-white">Share a Post</h3>
      <p className="text-white/40 text-sm">Paste a URL from a post or article</p>

      <div>
        <label className="text-white/40 text-xs mb-2 block">Post URL</label>
        <div className="relative">
          <input
            type="url"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder="https://example.com/post/..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#00f0ff]/50 transition-colors pr-12"
          />
          {feedUrl.trim() && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#39ff14]/20 flex items-center justify-center"
              style={{ color: '#39ff14' }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </motion.button>
          )}
        </div>
      </div>

      <div>
        <label className="text-white/40 text-xs mb-2 block">Add a caption (optional)</label>
        <textarea
          value={feedCaption}
          onChange={(e) => setFeedCaption(e.target.value)}
          placeholder="What do you think about this?"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none resize-none focus:border-[#00f0ff]/50 transition-colors"
          rows={3}
        />
      </div>

      {feedUrl.trim() && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white/[0.04] border border-[#00f0ff]/15 overflow-hidden"
        >
          <div className="h-32 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,240,255,0.15) 0%, rgba(255,0,170,0.1) 100%)' }}>
            <span className="text-4xl">📰</span>
          </div>
          <div className="p-4">
            <p className="text-white/30 text-xs mb-1">{feedUrl ? new URL(feedUrl.startsWith('http') ? feedUrl : 'https://' + feedUrl).hostname : 'Link preview'}</p>
            <p className="text-white font-semibold text-sm mb-1">{feedCaption || 'Shared post from the feed'}</p>
            <p className="text-white/40 text-xs truncate">{feedUrl}</p>
          </div>
        </motion.div>
      )}
    </div>
  )

  // =========================================================================
  // RENDER
  // =========================================================================

  if (!open) return null

  const currentLang = LANGUAGES.find((l) => l.code === language)

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* ============ HEADER ============ */}
      <header className="flex items-center justify-between px-4 py-3 shrink-0 relative z-30">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.06] text-white/70 hover:text-white transition-colors"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </motion.button>

        <h1
          className="text-sm font-bold tracking-wide"
          style={{ color: '#00f0ff', textShadow: '0 0 10px rgba(0,240,255,0.5)' }}
        >
          Create Story
        </h1>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handlePublish}
          disabled={publishing || published}
          className={cn(
            'relative px-5 py-2 rounded-full text-sm font-bold transition-all overflow-hidden',
            (publishing || published) ? 'bg-white/20 text-white/40 cursor-wait' : 'text-[#0a0a0f]',
          )}
          style={
            !publishing && !published
              ? { background: 'linear-gradient(135deg, #00f0ff 0%, #ff00aa 100%)', boxShadow: '0 0 20px rgba(0,240,255,0.4), 0 0 40px rgba(255,0,170,0.2)' }
              : undefined
          }
        >
          {publishing && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            {publishing ? (
              <>
                <svg className="animate-spin" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                Posting...
              </>
            ) : published ? (
              '✓ Done'
            ) : (
              'Post'
            )}
          </span>
        </motion.button>
      </header>

      {/* ============ COLLAPSIBLE OPTIONS ROW ============ */}
      <div className="shrink-0 px-4 pb-2 relative z-20">
        <div className="flex items-center gap-2">
          {/* Audience */}
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { setAudienceOpen(!audienceOpen); setExpiryOpen(false); setLanguageOpen(false) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                audienceOpen
                  ? 'border-[#00f0ff] bg-[#00f0ff]/10 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                  : 'border-white/[0.08] bg-white/[0.04] text-white/60',
              )}
            >
              <span>{AUDIENCE_OPTIONS.find((a) => a.value === audience)?.icon}</span>
              <span>{AUDIENCE_OPTIONS.find((a) => a.value === audience)?.label}</span>
              <svg className={cn('w-3 h-3 transition-transform', audienceOpen && 'rotate-180')} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
            </motion.button>
            <AnimatePresence>
              {audienceOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1.5 bg-[#13131a] border border-[#00f0ff]/20 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.15)] p-1.5 min-w-[160px] z-50"
                >
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <motion.button
                      key={opt.value}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setAudience(opt.value); setAudienceOpen(false) }}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-all',
                        audience === opt.value
                          ? 'bg-[#00f0ff]/15 text-[#00f0ff]'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.04]',
                      )}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Expiry */}
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { setExpiryOpen(!expiryOpen); setAudienceOpen(false); setLanguageOpen(false) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                expiryOpen
                  ? 'border-[#00f0ff] bg-[#00f0ff]/10 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                  : 'border-white/[0.08] bg-white/[0.04] text-white/60',
              )}
            >
              <span>⏱</span>
              <span>{EXPIRY_OPTIONS.find((e) => e.value === expiry)?.label}</span>
              <svg className={cn('w-3 h-3 transition-transform', expiryOpen && 'rotate-180')} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
            </motion.button>
            <AnimatePresence>
              {expiryOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1.5 bg-[#13131a] border border-[#00f0ff]/20 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.15)] p-1.5 min-w-[140px] z-50"
                >
                  {EXPIRY_OPTIONS.map((opt) => (
                    <motion.button
                      key={opt.value}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setExpiry(opt.value); setExpiryOpen(false) }}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-all',
                        expiry === opt.value
                          ? 'bg-[#00f0ff]/15 text-[#00f0ff]'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.04]',
                      )}
                    >
                      <span>{opt.label}</span>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Language */}
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { setLanguageOpen(!languageOpen); setAudienceOpen(false); setExpiryOpen(false) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                languageOpen
                  ? 'border-[#00f0ff] bg-[#00f0ff]/10 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                  : 'border-white/[0.08] bg-white/[0.04] text-white/60',
              )}
            >
              <span>{currentLang?.flag}</span>
              <span>{currentLang?.nativeLabel}</span>
              <svg className={cn('w-3 h-3 transition-transform', languageOpen && 'rotate-180')} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
            </motion.button>
            <AnimatePresence>
              {languageOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1.5 bg-[#13131a] border border-[#00f0ff]/20 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.15)] p-1.5 min-w-[160px] max-h-[200px] overflow-y-auto z-50"
                >
                  {LANGUAGES.map((lang) => (
                    <motion.button
                      key={lang.code}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setLanguage(lang.code); setLanguageOpen(false) }}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-all',
                        language === lang.code
                          ? 'bg-[#00f0ff]/15 text-[#00f0ff]'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.04]',
                      )}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.nativeLabel}</span>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ============ SCROLLABLE CANVAS AREA ============ */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10" onClick={closeDropdowns}>
        <AnimatePresence mode="wait">
          <motion.div
            key={format}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="px-4 pb-4"
          >
            {format === 'text' && renderTextCanvas()}
            {format === 'voice' && renderVoiceCanvas()}
            {format === 'thread' && renderThreadCanvas()}
            {format === 'poll' && renderPollCanvas()}
            {format === 'festival' && renderFestivalCanvas()}
            {format === 'cricket' && renderCricketCanvas()}
            {format === 'feed' && renderFeedCanvas()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ============ FORMAT STRIP (Bottom) ============ */}
      <div className="shrink-0 z-20 border-t border-white/[0.06] bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {FORMAT_OPTIONS.map((fmt) => (
            <motion.button
              key={fmt.value}
              whileTap={{ scale: 0.92 }}
              onClick={() => setFormat(fmt.value)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-full whitespace-nowrap text-xs font-medium transition-all shrink-0 border',
                format === fmt.value
                  ? 'border-[#00f0ff] bg-[#00f0ff]/10 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                  : 'border-white/[0.08] bg-white/[0.04] text-white/50 hover:text-white/70',
              )}
              style={format === fmt.value ? { color: '#00f0ff', textShadow: '0 0 8px rgba(0,240,255,0.4)' } : undefined}
            >
              <span className={cn('text-sm', format === fmt.value && 'drop-shadow-[0_0_6px_rgba(0,240,255,0.6)]')}>
                {fmt.icon}
              </span>
              <span>{fmt.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
