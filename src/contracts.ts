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
