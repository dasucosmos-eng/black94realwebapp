'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/stores/app'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { AdCampaign } from '@/lib/crm'

const CTA_OPTIONS = ['Learn More', 'Shop Now', 'Sign Up', 'Contact Us', 'Download']
const DURATION_OPTIONS = [
  { label: '1 day', value: 1 },
  { label: '3 days', value: 3 },
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
]
const AGE_OPTIONS = ['18-24', '25-34', '35-44', '45+']
const LOCATION_OPTIONS = ['All India', 'Metro Cities', 'Tier 2 Cities']
const INTEREST_OPTIONS = ['Technology', 'Fashion', 'Food', 'Business', 'Sports', 'Music']
const BUDGET_PRESETS = [500, 1000, 5000, 10000]

export function CreateAdView() {
  const navigate = useAppStore((s) => s.navigate)
  const [form, setForm] = useState({
    name: '',
    headline: '',
    description: '',
    ctaText: 'Learn More',
    ctaUrl: '',
    budget: 1000,
    duration: 7,
    targetAge: '25-34',
    targetLocation: 'All India',
    interests: [] as string[],
  })
  const [submitting, setSubmitting] = useState(false)

  const update = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }))

  const toggleInterest = (interest: string) => {
    setForm(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest],
    }))
  }

  const isValid = useMemo(() => {
    return form.name.trim() && form.headline.trim() && form.description.trim() && form.ctaUrl.trim() && form.budget > 0
  }, [form])

  const handleSubmit = () => {
    if (!isValid) {
      toast.error('Please fill in all required fields')
      return
    }
    setSubmitting(true)
    const campaign: AdCampaign = {
      id: `AD-${Date.now()}`,
      name: form.name,
      headline: form.headline,
      description: form.description,
      ctaText: form.ctaText,
      ctaUrl: form.ctaUrl,
      budget: form.budget,
      duration: form.duration,
      targetAge: form.targetAge,
      targetLocation: form.targetLocation,
      interests: form.interests,
      status: 'Active',
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      createdAt: new Date().toISOString().split('T')[0],
    }

    const stored = localStorage.getItem('black94_ads')
    const existing = stored ? JSON.parse(stored) : []
    localStorage.setItem('black94_ads', JSON.stringify([campaign, ...existing]))

    setTimeout(() => {
      setSubmitting(false)
      toast.success('Campaign created successfully!')
      navigate('ads-manager')
    }, 600)
  }

  return (
    <div className="px-4 pt-2 pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('ads-manager')} className="p-2 -ml-2 rounded-full hover:bg-white/[0.06] transition-colors">
          <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h1 className="text-xl font-bold text-[#e7e9ea]">Create Ad</h1>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Ad Name */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8] font-medium">Ad Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="e.g., Summer Sale Campaign"
            className="w-full bg-[#000000] border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
          />
        </div>

        {/* Headline */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-[13px] text-[#94a3b8] font-medium">Headline *</label>
            <span className="text-[12px] text-[#64748b]">{form.headline.length}/50</span>
          </div>
          <input
            type="text"
            value={form.headline}
            onChange={e => update('headline', e.target.value.slice(0, 50))}
            placeholder="Grab attention in 50 chars"
            maxLength={50}
            className="w-full bg-[#000000] border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-[13px] text-[#94a3b8] font-medium">Description *</label>
            <span className="text-[12px] text-[#64748b]">{form.description.length}/150</span>
          </div>
          <textarea
            value={form.description}
            onChange={e => update('description', e.target.value.slice(0, 150))}
            placeholder="Describe your ad in detail..."
            maxLength={150}
            rows={3}
            className="w-full bg-[#000000] border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors resize-none"
          />
        </div>

        {/* CTA Text */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8] font-medium">CTA Text</label>
          <select
            value={form.ctaText}
            onChange={e => update('ctaText', e.target.value)}
            className="w-full bg-[#000000] border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] outline-none focus:border-[#FFFFFF]/50 transition-colors appearance-none"
          >
            {CTA_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-[#000000] text-[#e7e9ea]">{opt}</option>)}
          </select>
        </div>

        {/* CTA URL */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8] font-medium">CTA URL *</label>
          <input
            type="url"
            value={form.ctaUrl}
            onChange={e => update('ctaUrl', e.target.value)}
            placeholder="https://your-landing-page.com"
            className="w-full bg-[#000000] border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
          />
        </div>

        {/* Image Upload */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8] font-medium">Ad Image</label>
          <button
            disabled
            className="w-full border-2 border-dashed border-white/[0.1] rounded-lg p-6 flex flex-col items-center gap-2 opacity-50 cursor-not-allowed"
          >
            <svg className="w-8 h-8 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
            <span className="text-[13px] text-[#64748b]">Tap to upload image</span>
          </button>
        </div>

        {/* Budget */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8] font-medium">Budget (₹)</label>
          <input
            type="number"
            value={form.budget}
            onChange={e => update('budget', parseInt(e.target.value) || 0)}
            className="w-full bg-[#000000] border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
          />
          <div className="flex gap-2">
            {BUDGET_PRESETS.map(amount => (
              <button
                key={amount}
                onClick={() => update('budget', amount)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors',
                  form.budget === amount
                    ? 'bg-[#FFFFFF] text-black'
                    : 'bg-white/[0.06] text-[#e7e9ea] hover:bg-white/[0.1]'
                )}
              >
                ₹{amount.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <label className="text-[13px] text-[#94a3b8] font-medium">Duration</label>
          <select
            value={form.duration}
            onChange={e => update('duration', parseInt(e.target.value))}
            className="w-full bg-[#000000] border border-white/[0.08] rounded-lg px-4 py-2.5 text-[15px] text-[#e7e9ea] outline-none focus:border-[#FFFFFF]/50 transition-colors appearance-none"
          >
            {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value} className="bg-[#000000] text-[#e7e9ea]">{d.label}</option>)}
          </select>
        </div>

        {/* Target Audience */}
        <div className="space-y-3">
          <label className="text-[13px] text-[#94a3b8] font-medium">Target Audience</label>

          {/* Age Range */}
          <div className="space-y-1.5">
            <p className="text-[12px] text-[#64748b]">Age Range</p>
            <div className="flex gap-2 flex-wrap">
              {AGE_OPTIONS.map(age => (
                <button
                  key={age}
                  onClick={() => update('targetAge', age)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors',
                    form.targetAge === age
                      ? 'bg-[#FFFFFF] text-black'
                      : 'bg-white/[0.06] text-[#e7e9ea] hover:bg-white/[0.1]'
                  )}
                >
                  {age}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <p className="text-[12px] text-[#64748b]">Location</p>
            <div className="flex gap-2 flex-wrap">
              {LOCATION_OPTIONS.map(loc => (
                <button
                  key={loc}
                  onClick={() => update('targetLocation', loc)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors',
                    form.targetLocation === loc
                      ? 'bg-[#FFFFFF] text-black'
                      : 'bg-white/[0.06] text-[#e7e9ea] hover:bg-white/[0.1]'
                  )}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Interest Tags */}
          <div className="space-y-1.5">
            <p className="text-[12px] text-[#64748b]">Interests</p>
            <div className="flex gap-2 flex-wrap">
              {INTEREST_OPTIONS.map(interest => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors',
                    form.interests.includes(interest)
                      ? 'bg-[#FFFFFF] text-black'
                      : 'bg-white/[0.06] text-[#e7e9ea] hover:bg-white/[0.1]'
                  )}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Card */}
      <div className="rounded-xl bg-[#000000] border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-2 border-b border-white/[0.06]">
          <p className="text-[11px] text-[#94a3b8] font-semibold uppercase tracking-wide">Ad Preview</p>
        </div>
        <div className="p-4">
          <div className="rounded-lg border border-white/[0.06] overflow-hidden">
            {/* Image upload area */}
            <div className="h-32 bg-gradient-to-br from-[#1a2a1a] to-[#110f1a] flex items-center justify-center">
              <span className="text-[#64748b] text-[13px]">Ad Image Preview</span>
            </div>
            <div className="p-3">
              <h4 className="text-[15px] font-bold text-[#e7e9ea]">{form.headline || 'Your headline here'}</h4>
              <p className="text-[13px] text-[#94a3b8] mt-1 line-clamp-2">{form.description || 'Your description will appear here...'}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[11px] text-[#64748b]">Sponsored</span>
                <span className="text-[11px] text-[#64748b]">•</span>
                <span className="text-[11px] text-[#64748b]">black94.in</span>
              </div>
              <button className="mt-3 w-full py-2 rounded-lg bg-[#FFFFFF] text-black text-[13px] font-bold text-center">
                {form.ctaText}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !isValid}
        className={cn(
          'w-full py-3 rounded-full text-[15px] font-bold transition-all duration-200',
          isValid && !submitting
            ? 'bg-[#FFFFFF] text-black hover:bg-[#D1D5DB] active:scale-[0.98]'
            : 'bg-white/[0.06] text-[#64748b] pointer-events-none'
        )}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Creating...
          </span>
        ) : 'Launch Campaign'}
      </button>
    </div>
  )
}
