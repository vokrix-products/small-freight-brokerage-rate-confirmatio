import { useState } from 'react'
import { Download, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  SHOW_CREATE_BUTTON,
  SHOW_EXPORT_BUTTON,
  SHOW_IMPORT_BUTTON,
} from '@/product-config'
import { downloadCsv, tasksToCsv } from '../data/export-csv'
import { fetchApprovedTasks } from '../data/tasks'
import { useTasks } from './tasks-provider'

export function TasksPrimaryButtons() {
  const { setOpen } = useTasks()
  const [exporting, setExporting] = useState(false)

  if (!SHOW_CREATE_BUTTON && !SHOW_IMPORT_BUTTON && !SHOW_EXPORT_BUTTON) {
    return null
  }

  // Exports every approved record as a flat CSV for TMS import. Reports the
  // real outcome: a success toast is only shown once a file is generated.
  async function handleExportApproved() {
    setExporting(true)
    try {
      const tasks = await fetchApprovedTasks()
      if (tasks.length === 0) {
        toast.info('No approved records yet — approve a record first.')
        return
      }
      downloadCsv(
        tasksToCsv(tasks),
        `tms-export-approved-${new Date().toISOString().slice(0, 10)}.csv`
      )
      toast.success(
        `Exported ${tasks.length} approved record${tasks.length > 1 ? 's' : ''} to CSV.`
      )
    } catch (err) {
      toast.error(
        `Export failed: ${err instanceof Error ? err.message : 'unknown error'}`
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className='flex gap-2'>
      {SHOW_EXPORT_BUTTON && (
        <Button
          variant='outline'
          className='space-x-1'
          onClick={handleExportApproved}
          disabled={exporting}
        >
          <span>{exporting ? 'Exporting...' : 'Export approved'}</span>
          <Download size={18} />
        </Button>
      )}
      {SHOW_IMPORT_BUTTON && (
        <Button
          variant='outline'
          className='space-x-1'
          onClick={() => setOpen('import')}
        >
          <span>Import</span> <Download size={18} />
        </Button>
      )}
      {SHOW_CREATE_BUTTON && (
        <Button className='space-x-1' onClick={() => setOpen('create')}>
          <span>Create</span> <Plus size={18} />
        </Button>
      )}
    </div>
  )
}
