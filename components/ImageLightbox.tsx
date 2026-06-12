"use client"

import { useState } from "react"
import type { AccountId } from "@/lib/types"
import { getSaveFolderHandle, saveToFolder } from "@/lib/save-folder"

interface Props {
  src: string
  name: string
  account: AccountId
  onClose: () => void
}

function dataUriToBlob(dataUri: string): Blob {
  const [header, data] = dataUri.split(",")
  const mimeType = header.match(/:(.*?);/)?.[1] ?? "image/jpeg"
  const bytes = atob(data)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mimeType })
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
}

const btnBase =
  "text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75 disabled:opacity-50"

export default function ImageLightbox({ src, name, account, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const blob = src.startsWith("data:") ? dataUriToBlob(src) : await fetch(src).then(r => r.blob())
      const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg"
      const filename = name.includes(".") ? name : `${name}.${ext}`

      const folderHandle = await getSaveFolderHandle(account).catch(() => null)
      if (folderHandle) {
        const ok = await saveToFolder(folderHandle, filename, blob)
        if (ok) { setSaved(true); return }
      }
      triggerDownload(blob, filename)
      setSaved(true)
    } catch {
      // silently fall through — user can try again
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 rounded-xl"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden max-w-[92%] max-h-[92%]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 overflow-auto p-3 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={name}
            className="max-w-full max-h-[65vh] object-contain select-none"
            onContextMenu={e => e.preventDefault()}
          />
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-100 shrink-0">
          <span className="text-xs text-zinc-400 flex-1 truncate">{name}</span>
          {saved && <span className="text-xs text-emerald-600">Saved ✓</span>}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || saved}
            className={btnBase}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onClose} className={btnBase}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
