import React from 'react'
import {
  IconSearchOutlineRegular, IconPlusOutlineRegular, IconSettingsOutlineRegular,
  IconCloseOutlineRegular, IconPinOutlineRegular, IconArchiveOutlineRegular,
  IconUnarchiveOutlineRegular, IconEllipsisOutlineRegular, IconCheckOutlineRegular,
  IconRefreshOutlineRegular, IconDeliverDocRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
const icons={note:IconDeliverDocRegular,search:IconSearchOutlineRegular,plus:IconPlusOutlineRegular,
  settings:IconSettingsOutlineRegular,close:IconCloseOutlineRegular,pin:IconPinOutlineRegular,
  archive:IconArchiveOutlineRegular,restore:IconUnarchiveOutlineRegular,more:IconEllipsisOutlineRegular,
  check:IconCheckOutlineRegular,save:IconRefreshOutlineRegular}
export type IconName=keyof typeof icons
export function Icon({name,size=18}:{name:IconName;size?:number}){const Component=icons[name];return <Component size={size}/>}
export function NotesIcon({size=32}:{size?:number}){return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="11" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeOpacity=".12"/><path d="M11 14v15a2 2 0 0 0 2 2h13" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5"/><path d="M16 9h9l5 5v12a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.5"/><path d="M25 9v5h5M18 19h8M18 23h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
