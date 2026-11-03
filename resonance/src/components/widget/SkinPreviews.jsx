import { X } from 'lucide-react'

const block = 'bg-white/70 rounded-sm'

export function CompactPreview() {
  return (
    <div className="flex w-10 items-center gap-1">
      <div className={`${block} h-6 w-6 shrink-0`} />
      <div className="flex-1 space-y-1">
        <div className={`${block} h-1.5 w-full`} />
        <div className={`${block} h-1.5 w-2/3`} />
      </div>
    </div>
  )
}

export function BoxyPreview() {
  return (
    <div className="flex w-10 items-center gap-1">
      <div className={`${block} h-8 w-8 shrink-0`} />
      <div className="flex-1 space-y-1">
        <div className={`${block} h-1.5 w-full`} />
        <div className={`${block} h-1.5 w-1/2`} />
      </div>
    </div>
  )
}

export function GalleryPreview() {
  return <div className={`${block} h-10 w-10`} />
}

export function MinimalPreview() {
  return <div className={`${block} h-1 w-10`} />
}

export function MacOSPreview() {
  return (
    <div className="w-12 space-y-1 rounded-lg bg-white/10 p-1.5">
      <div className={`${block} h-1 w-full`} />
      <div className={`${block} h-1 w-2/3`} />
    </div>
  )
}

export function ShellPreview() {
  return (
    <div className="flex w-12 items-center gap-1 rounded-full bg-white/10 p-1">
      <div className="h-4 w-4 shrink-0 rounded-full bg-white/70" />
      <div className={`${block} h-1 flex-1`} />
    </div>
  )
}

export function DiscordPreview() {
  return (
    <div className="w-12 space-y-1 rounded-md bg-[#5865f2]/30 p-1.5">
      <div className={`${block} h-1 w-2/3`} />
      <div className={`${block} h-1 w-full`} />
    </div>
  )
}

/* --- yeni skin önizlemeleri --- */

export function ClearPreview() {
  return (
    <div className="flex w-12 items-center gap-1">
      <div className="h-5 w-5 shrink-0 rounded-sm border border-dashed border-white/50" />
      <div className="flex-1 space-y-1">
        <div className={`${block} h-1 w-full`} />
        <div className="h-0.5 w-2/3 rounded-full bg-white/40" />
      </div>
    </div>
  )
}

export function RingPreview() {
  return (
    <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white/20">
      <div className="absolute inset-[-3px] rounded-full border-[3px] border-transparent border-t-white/80 border-r-white/80" />
      <div className="h-4 w-4 rounded-full bg-white/70" />
    </div>
  )
}

export function AuroraPreview() {
  return (
    <div
      className="w-12 space-y-1 rounded-xl border border-white/30 p-1.5"
      style={{ background: 'linear-gradient(135deg, rgba(124,245,193,0.55), rgba(124,58,237,0.5))' }}
    >
      <div className={`${block} h-1 w-2/3`} />
      <div className={`${block} h-1 w-full`} />
    </div>
  )
}

export function EdgePreview() {
  return (
    <div
      className="w-12 space-y-1 rounded-md border-2 border-white/80 bg-black/30 p-1.5"
      style={{ borderLeftWidth: 5 }}
    >
      <div className={`${block} h-1 w-2/3`} />
      <div className={`${block} h-1 w-full`} />
    </div>
  )
}

export function TurntablePreview() {
  return (
    <div className="relative h-8 w-10">
      <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/70">
        <div className="h-2 w-2 rounded-full bg-[var(--color-surface-3)]" />
      </div>
      <div className="absolute right-0.5 top-0 h-6 w-0.5 origin-top rotate-[28deg] rounded-full bg-white" />
    </div>
  )
}

export function CassettePreview() {
  return (
    <div className="w-12 space-y-1 rounded-sm border border-white/60 bg-black/30 p-1">
      <div className={`${block} h-1 w-full`} />
      <div className="flex justify-between px-1">
        <div className="h-2.5 w-2.5 rounded-full border border-white/80" />
        <div className="h-2.5 w-2.5 rounded-full border border-white/80" />
      </div>
    </div>
  )
}

export function SquarePreview() {
  return <div className="h-8 w-8 rounded-sm bg-white/70" />
}

export function VinylPreview() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70">
      <div className="h-2 w-2 rounded-full bg-[var(--color-surface-3)]" />
    </div>
  )
}

export function NonePreview() {
  return <X className="h-5 w-5 text-white/40" />
}
