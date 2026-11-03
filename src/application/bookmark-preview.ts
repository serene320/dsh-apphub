import type {BookmarkPreview} from '../contracts.ts'

export function previewNeedsRefresh(preview:BookmarkPreview|undefined|null,now=Date.now()){
 return !preview||!Number.isFinite(Date.parse(preview.checkedAt))||now-Date.parse(preview.checkedAt)>=(preview.status==='failed'?300000:86400000)
}
