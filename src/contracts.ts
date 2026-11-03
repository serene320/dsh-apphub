export interface AppSummary {
  id: string
  name: string
  description: string
}
export interface HubSnapshot {
  requestId: string
  checkedAt: string
  apps: AppSummary[]
}

export interface Note {
  id: string
  title: string
  body: string
  pinned?: boolean
  archived?: boolean
  color?: string
  revision: number
  createdAt: string
  updatedAt: string
}
export interface SaveNote {
  id: string
  title: string
  body: string
  pinned?: boolean
  archived?: boolean
  color?: string
  expectedRevision: number
}
export interface NoteSaveResult {
  status: 'saved' | 'conflict' | 'invalid' | 'unavailable'
  note?: Note
}

export type SettingsScope = 'hub' | 'notes'
export interface HubSettings {
  appearance: 'host' | 'light' | 'dark'
  revision: number
}
export interface SettingsResult { status: 'saved' | 'conflict' | 'invalid'; settings: HubSettings }
export interface NoteTask { id: string; sessionId: string; noteId: string; status: 'pending' | 'saved' | 'partial' | 'failed'; savedCount:number; failedCount:number; pendingCount:number; note?: Note }

export interface BookmarkInput { id:string; url:string; title:string; description:string; tags:string[]; collections:string[]; expectedRevision:number }
export interface Bookmark extends Omit<BookmarkInput,'expectedRevision'> { revision:number; createdAt:string; updatedAt:string; deletedAt:string|null; source:'manual'|'chrome-html' }
export interface BookmarkResult { status:'saved'|'duplicate'|'conflict'|'invalid'; bookmark?:Bookmark }
export interface BookmarkImportItem { url:string; title:string; collections:string[] }
export interface BookmarkImportPreview { items:BookmarkImportItem[]; skipped:number }
export interface BookmarkImportResult { added:number; duplicates:number; skipped:number }
