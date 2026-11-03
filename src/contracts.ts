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
export interface Bookmark extends Omit<BookmarkInput,'expectedRevision'> { revision:number; createdAt:string; updatedAt:string; deletedAt:string|null; source:'manual'|'chrome-html'|'ai'; aiSummary?:string; sources?:string[]; preview?:BookmarkPreview }
export interface BookmarkResult { status:'saved'|'duplicate'|'conflict'|'invalid'; bookmark?:Bookmark }
export interface BookmarkImportItem { url:string; title:string; collections:string[] }
export interface BookmarkImportPreview { items:BookmarkImportItem[]; skipped:number }
export interface BookmarkImportResult { added:number; duplicates:number; skipped:number }
export interface BookmarkPage { items:Bookmark[]; total:number; collections:string[]; offset:number }
export interface BookmarkAiItem { url:string; title:string; summary:string; collections:string[]; tags:string[]; sources:string[] }
export interface BookmarkAiResult { results:{url:string;id?:string;status:'created'|'existing'|'updated'|'failed';error?:string}[] }
export interface BookmarkTask { id:string;sessionId:string;status:'pending'|'saved'|'partial';savedCount:number;failedCount:number;pendingCount:number;existingCount:number;createdCount:number;updatedCount:number }
export interface BookmarkPreview { status:'ready'|'failed';title:string;description:string;image:string;icon:string;error:string;checkedAt:string }
