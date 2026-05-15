import type { Article } from '@/stores/app'

const STORAGE_KEY = 'black94_articles'

/** Persist a single article (upsert by id) into localStorage */
export function saveArticle(article: Article): void {
  const articles = getAllArticles()
  const idx = articles.findIndex((a) => a.id === article.id)
  if (idx >= 0) {
    articles[idx] = article
  } else {
    articles.unshift(article)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles))
}

/** Retrieve one article by id */
export function getArticle(articleId: string): Article | null {
  const articles = getAllArticles()
  return articles.find((a) => a.id === articleId) ?? null
}

/** Return every article stored in localStorage */
export function getAllArticles(): Article[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Article[]) : []
  } catch {
    return []
  }
}

/** Delete an article by id */
export function deleteArticle(articleId: string): void {
  const articles = getAllArticles().filter((a) => a.id !== articleId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles))
}

/** Generate a random 12-char hex id */
export function generateArticleId(): string {
  return Math.random().toString(16).slice(2, 14)
}

/** Split content on whitespace and count tokens */
export function getWordCount(content: string): number {
  if (!content.trim()) return 0
  return content.trim().split(/\s+/).length
}

/** Estimated reading time based on 200 wpm */
export function calculateReadTime(content: string): string {
  const words = getWordCount(content)
  const mins = Math.max(1, Math.ceil(words / 200))
  return `${mins} min read`
}
