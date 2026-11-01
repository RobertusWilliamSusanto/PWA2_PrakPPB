import { useState, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { subscribeSchemaStatus, getSchemaStatus } from '../../utils/schemaDetector'

export default function DevMigrationBanner() {
  const [status, setStatus] = useState(() => getSchemaStatus())
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    return subscribeSchemaStatus((newStatus) => {
      setStatus({ ...newStatus })
    })
  }, [])

  if (dismissed || !status.checked || status.missingMigrations.length === 0) {
    return null
  }

  return (
    <div
      className="dev-migration-banner p-3 px-4 bg-amber-950/80 border-b border-amber-600/60 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-md relative z-50"
      role="alert"
    >
      <div className="flex items-center gap-2.5 flex-1">
        <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
        <div>
          <span className="font-bold text-amber-300">
            [DEV MODE] Mode Kompatibilitas Aktif (Migration Pending):
          </span>{' '}
          Fitur belum ada di database Supabase:{' '}
          <span className="underline font-mono text-amber-100">
            {status.missingMigrations.join(', ')}
          </span>
          . Jalankan{' '}
          <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300">
            supabase/migrations/20261101_combined_schema.sql
          </code>{' '}
          di Supabase SQL Editor untuk mengaktifkan skema penuh di server.
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="text-stone-400 hover:text-stone-200 p-1"
          onClick={() => setDismissed(true)}
          title="Tutup pemberitahuan"
          aria-label="Tutup pemberitahuan"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
