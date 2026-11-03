import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import React from 'react'
import {Icon} from './Icons.tsx'
import type { HubSettings } from '../contracts.ts'
export function Settings({scope,value,busy,error,loaded,onRetry,onSave,onClose}: {scope:'hub'|'notes';value:HubSettings;busy:boolean;error:string;loaded:boolean;onRetry():void;onSave(value:HubSettings):Promise<boolean>;onClose():void}) {
  return <Modal open title={scope==='hub'?'AppHub 设置':'备忘录设置'} closeLabel="关闭设置" onClose={onClose} className={'hub-settings apphub-appearance-'+value.appearance}>
    <section><h3>外观</h3><div className="appearance-options" aria-label="外观">{([{id:'light',label:'浅色'},{id:'dark',label:'暗色'},{id:'host',label:'跟随 DSH'}] as const).map(option=><Button size="sm" key={option.id} aria-pressed={value.appearance===option.id} disabled={!loaded||busy} onClick={()=>{if(value.appearance!==option.id)void onSave({...value,appearance:option.id})}}><span className={'appearance-preview '+option.id}><i/><i/></span><span>{option.label}</span>{value.appearance===option.id&&<Icon name="check" size={14}/>}</Button>)}</div></section>
    {(error||!loaded)&&<footer><span role="status">{error}</span>{!loaded&&<Button size="sm" disabled={busy} onClick={onRetry}>重新读取设置</Button>}</footer>}
  </Modal>
}
