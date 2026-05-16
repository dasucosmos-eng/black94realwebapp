// =============================================================================
// Story Types, Constants & Helpers
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StoryFormat = 'text' | 'voice' | 'thread' | 'poll' | 'festival' | 'cricket' | 'feed'
export type StoryAudience = 'everyone' | 'followers' | 'close_friends' | 'subscribers'
export type StoryExpiry = '6h' | '24h' | '72h' | 'permanent'
export type Language = 'hi' | 'en' | 'te' | 'ta' | 'bn' | 'mr' | 'kn' | 'ml' | 'gu'
export type ReactionType = 'agree' | 'disagree' | 'fire' | 'skull' | 'mindblown' | 'clapping'

export interface LanguageOption {
  code: Language
  label: string
  nativeLabel: string
  flag: string
}

export interface StoryCard {
  id: string
  format: StoryFormat
  content: string
  mediaUrl?: string
  language: Language
  pollOptions?: PollOption[]
  festivalTemplate?: FestivalTemplate
  cricketData?: CricketMatch
  voiceWaveform?: number[]
  voiceDuration?: number
}

export interface PollOption {
  id: string
  text: string
  votes: number
  percentage: number
}

export interface CricketMatch {
  team1: string
  team2: string
  team1Score: string
  team2Score: string
  overs: string
  venue: string
  status: string
}

export interface FestivalTemplate {
  id: string
  name: string
  gradient: string
  emoji: string
  textColor: string
}

export interface StoryGroup {
  creatorId: string
  creatorName: string
  creatorHandle: string
  creatorAvatar: string
  creatorVerified: boolean
  creatorCountry: string
  creatorLanguages: Language[]
  viewed: boolean
  stories: StoryCard[]
  createdAt: string
  viewCount: number
  isCollab?: boolean
  collabAvatars?: string[]
  tippingEnabled: boolean
  upiId?: string
  trendingTopic?: string
  reactions: Record<ReactionType, number>
}

// ---------------------------------------------------------------------------
// Language options
// ---------------------------------------------------------------------------

export const LANGUAGES: LanguageOption[] = [
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', flag: '🇮🇳' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', flag: '🇮🇳' },
]

// ---------------------------------------------------------------------------
// Festival Templates (12)
// ---------------------------------------------------------------------------

export const FESTIVAL_TEMPLATES: FestivalTemplate[] = [
  {
    id: 'diwali',
    name: 'Diwali',
    gradient: 'linear-gradient(135deg, #FF6F00 0%, #FF8F00 30%, #FFD54F 60%, #FFF8E1 100%)',
    emoji: '🪔',
    textColor: '#FFFFFF',
  },
  {
    id: 'holi',
    name: 'Holi',
    gradient: 'linear-gradient(135deg, #E91E63 0%, #AB47BC 25%, #42A5F5 50%, #66BB6A 75%, #FFEE58 100%)',
    emoji: '🎨',
    textColor: '#FFFFFF',
  },
  {
    id: 'eid',
    name: 'Eid',
    gradient: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 40%, #A5D6A7 70%, #FFD54F 100%)',
    emoji: '🌙',
    textColor: '#FFFFFF',
  },
  {
    id: 'onam',
    name: 'Onam',
    gradient: 'linear-gradient(135deg, #F9A825 0%, #FDD835 30%, #AED581 60%, #4CAF50 100%)',
    emoji: '🌸',
    textColor: '#33691E',
  },
  {
    id: 'navratri',
    name: 'Navratri',
    gradient: 'linear-gradient(135deg, #B71C1C 0%, #D32F2F 30%, #FF5722 60%, #FF8A65 100%)',
    emoji: '🙏',
    textColor: '#FFFFFF',
  },
  {
    id: 'pongal',
    name: 'Pongal',
    gradient: 'linear-gradient(135deg, #E65100 0%, #F57C00 30%, #FFB300 60%, #FFF9C4 100%)',
    emoji: '🌾',
    textColor: '#FFFFFF',
  },
  {
    id: 'durga-puja',
    name: 'Durga Puja',
    gradient: 'linear-gradient(135deg, #880E4F 0%, #AD1457 30%, #FCE4EC 60%, #FFFFFF 100%)',
    emoji: '🏵️',
    textColor: '#FFFFFF',
  },
  {
    id: 'baisakhi',
    name: 'Baisakhi',
    gradient: 'linear-gradient(135deg, #F57F17 0%, #FBC02D 30%, #FFEE58 60%, #FFF8E1 100%)',
    emoji: '🥁',
    textColor: '#4E342E',
  },
  {
    id: 'christmas',
    name: 'Christmas',
    gradient: 'linear-gradient(135deg, #B71C1C 0%, #C62828 35%, #2E7D32 65%, #1B5E20 100%)',
    emoji: '🎄',
    textColor: '#FFFFFF',
  },
  {
    id: 'new-year',
    name: 'New Year',
    gradient: 'linear-gradient(135deg, #1A0033 0%, #4A148C 30%, #7B1FA2 55%, #FFD700 100%)',
    emoji: '🎆',
    textColor: '#FFFFFF',
  },
  {
    id: 'eid-ul-adha',
    name: 'Eid ul-Adha',
    gradient: 'linear-gradient(135deg, #1B5E20 0%, #388E3C 30%, #8D6E63 60%, #FFD54F 100%)',
    emoji: '🐪',
    textColor: '#FFFFFF',
  },
  {
    id: 'raksha-bandhan',
    name: 'Raksha Bandhan',
    gradient: 'linear-gradient(135deg, #C2185B 0%, #E91E63 35%, #F48FB1 65%, #FCE4EC 100%)',
    emoji: '🧵',
    textColor: '#FFFFFF',
  },
]

// ---------------------------------------------------------------------------
// Story groups (populated from server)
// ---------------------------------------------------------------------------

// Story groups are loaded from Firestore at runtime.

// ---------------------------------------------------------------------------
// Trending Topics
// ---------------------------------------------------------------------------

// Trending topics are loaded from Firestore at runtime.

// ---------------------------------------------------------------------------
// Audience options
// ---------------------------------------------------------------------------

export const AUDIENCE_OPTIONS: { value: StoryAudience; label: string; icon: string }[] = [
  { value: 'everyone', label: 'Everyone', icon: '🌍' },
  { value: 'followers', label: 'Followers only', icon: '👥' },
  { value: 'close_friends', label: 'Close friends', icon: '💚' },
  { value: 'subscribers', label: 'Subscribers only', icon: '⭐' },
]

// ---------------------------------------------------------------------------
// Expiry options
// ---------------------------------------------------------------------------

export const EXPIRY_OPTIONS: { value: StoryExpiry; label: string; description: string }[] = [
  { value: '6h', label: '6 hours', description: 'Quick updates and hot takes' },
  { value: '24h', label: '24 hours', description: 'Classic story — standard choice' },
  { value: '72h', label: '3 days', description: 'Weekend stories & events' },
  { value: 'permanent', label: 'Permanent', description: 'Highlights and important content' },
]

// ---------------------------------------------------------------------------
// Story format config (labels & icons)
// ---------------------------------------------------------------------------

export const STORY_FORMATS: { value: StoryFormat; label: string; icon: string; description: string }[] = [
  { value: 'text', label: 'Text', icon: '📝', description: 'Write a text story with a background' },
  { value: 'voice', label: 'Voice', icon: '🎙️', description: 'Record a voice note story' },
  { value: 'thread', label: 'Thread', icon: '🧵', description: 'Convert a thread into a story series' },
  { value: 'poll', label: 'Poll', icon: '📊', description: 'Ask your audience a question' },
  { value: 'festival', label: 'Festival', icon: '🎉', description: 'Share festival greetings with templates' },
  { value: 'cricket', label: 'Cricket', icon: '🏏', description: 'Live scores and match updates' },
  { value: 'feed', label: 'Feed', icon: '📰', description: 'Embed a post or article as a story' },
]

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Get the full `LanguageOption` object for a given language code.
 */
export function getLanguage(code: Language): LanguageOption {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]
}

/**
 * Map a reaction type to its display emoji.
 */
export function getReactionLabel(type: ReactionType): string {
  const map: Record<ReactionType, string> = {
    agree: '👍',
    disagree: '👎',
    fire: '🔥',
    skull: '💀',
    mindblown: '🤯',
    clapping: '👏',
  }
  return map[type]
}

/**
 * Format a number into a compact human-readable string.
 * Examples: 1200 → "1.2K", 45200 → "45.2K", 1000000 → "1M"
 */
export function formatCount(n: number): string {
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (n >= 1_000) {
    return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return n.toString()
}

/**
 * Returns the festival template matching the given id, or undefined.
 */
export function getFestivalTemplate(id: string): FestivalTemplate | undefined {
  return FESTIVAL_TEMPLATES.find((t) => t.id === id)
}

/**
 * Compute total reactions for a story group.
 */
export function getTotalReactions(reactions: Record<ReactionType, number>): number {
  return Object.values(reactions).reduce((sum, v) => sum + v, 0)
}

/**
 * Get the top reaction type (highest count) for a story group.
 */
export function getTopReaction(reactions: Record<ReactionType, number>): {
  type: ReactionType
  count: number
  emoji: string
} {
  const entries = Object.entries(reactions) as [ReactionType, number][]
  const [type, count] = entries.reduce(
    (best, cur) => (cur[1] > best[1] ? cur : best),
    entries[0],
  )
  return { type, count, emoji: getReactionLabel(type) }
}

/**
 * Sort story groups: unviewed first, then by viewCount descending.
 */
export function sortStoryGroups(groups: StoryGroup[]): StoryGroup[] {
  return [...groups].sort((a, b) => {
    if (a.viewed !== b.viewed) return a.viewed ? 1 : -1
    return b.viewCount - a.viewCount
  })
}
