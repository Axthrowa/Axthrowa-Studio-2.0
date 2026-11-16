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

export function PillPreview() {
  return <div className="flex h-4 w-12 items-center gap-1 rounded-full bg-white/20 px-0.5"><div className={`${block} h-3 w-3 rounded-full`} /><div className={`${block} h-1 flex-1`} /></div>
}

export function IslandPreview() {
  return <div className="flex h-4 w-11 items-center justify-between rounded-full bg-black px-1"><div className="h-2 w-2 rounded-full bg-white/70" /><div className="h-1 w-3 rounded bg-white/70" /></div>
}

export function StripPreview() {
  return <div className="h-2 w-14 border-l-2 border-white bg-white/30" />
}

export function AlbumFocusPreview() {
  return <div className={`${block} relative h-10 w-10`}><div className="absolute inset-x-0 bottom-0 h-3 bg-black/60" /></div>
}

export function SidebarPreview() {
  return <div className="flex h-12 w-7 flex-col items-center gap-0.5 rounded bg-white/15 p-0.5"><div className={`${block} h-5 w-5`} /><div className={`${block} h-1 w-5`} /><div className={`${block} h-1 w-3`} /></div>
}

export function GameboyPreview() {
  return <div className="rounded-sm bg-[#306230] p-0.5"><div className="h-5 w-11 bg-[#9bbc0f]" /></div>
}

export function HudPreview() {
  return <div className="h-6 w-12 border border-white/70 bg-white/10" style={{ clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)' }} />
}

export function StickyPreview() {
  return <div className="h-7 w-9 -rotate-3 bg-[#fcd34d]" />
}

export function NeonPreview() {
  return <div className="h-6 w-12 rounded border border-white shadow-[0_0_6px_rgba(255,255,255,.9)]" />
}

export function WavePreview() {
  return (
    <div className="flex h-6 w-12 items-center justify-between">
      {[3, 6, 4, 8, 5, 7, 3, 5].map((h, i) => (
        <div key={i} className="w-[3px] rounded-full bg-white/70" style={{ height: h * 2 }} />
      ))}
    </div>
  )
}

export function PosterPreview() {
  return (
    <div className="flex h-12 w-9 flex-col items-center gap-0.5 rounded-sm bg-white/15 p-0.5">
      <div className={`${block} h-7 w-7`} />
      <div className={`${block} h-1 w-6`} />
    </div>
  )
}

export function TerminalPreview() {
  return <div className="h-7 w-12 rounded-sm bg-black p-1 font-mono text-[8px] leading-none text-white/80">&gt;_</div>
}

export function LcdPreview() {
  return (
    <div className="flex h-7 w-12 items-center gap-1 rounded-sm bg-white/15 p-0.5">
      <div className="h-5 w-5 shrink-0 rounded-full bg-white/70" />
      <div className="h-4 flex-1 rounded-sm bg-[#9bbc0f]" />
    </div>
  )
}

export function TicketPreview() {
  return (
    <div className="flex h-6 w-12 rounded-sm bg-white/70">
      <div className="w-3 border-r border-dashed border-black/50" />
    </div>
  )
}

export function CirclePreview() {
  return <div className="h-8 w-8 rounded-full bg-white/70" />
}

export function HexagonPreview() {
  return <div className="h-8 w-8 bg-white/70" style={{ clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)' }} />
}

export function PolaroidPreview() {
  return (
    <div className="h-8 w-8 -rotate-3 bg-white p-0.5 pb-1.5">
      <div className="h-full w-full bg-black/40" />
    </div>
  )
}

export function DiscPreview() {
  return <div className="h-8 w-8 rounded-full bg-white/70" style={{ background: 'repeating-radial-gradient(circle, rgba(255,255,255,.75) 0 2px, rgba(255,255,255,.4) 2px 4px)' }} />
}

export function CdPreview() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'conic-gradient(#e2e8f0, #7dd3fc, #e2e8f0, #f9a8d4, #e2e8f0)' }}>
      <div className="h-2 w-2 rounded-full bg-[var(--color-surface-3)]" />
    </div>
  )
}

export function NonePreview() {
  return <X className="h-5 w-5 text-white/40" />
}
