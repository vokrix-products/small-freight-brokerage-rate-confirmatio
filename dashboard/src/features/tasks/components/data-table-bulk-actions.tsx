import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Check, Download, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { downloadCsv, tasksToCsv } from '../data/export-csv'
import { type Task } from '../data/schema'
import { useApproveTasks } from '../data/tasks'
import { TasksMultiDeleteDialog } from './tasks-multi-delete-dialog'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedTasks = selectedRows.map((row) => row.original as Task)
  const approveTasks = useApproveTasks()

  function handleApprove(approved: boolean) {
    const ids = selectedTasks.map((t) => t.id)
    if (ids.length === 0) return
    approveTasks.mutate(
      { ids, approved },
      {
        onSuccess: () => {
          const n = ids.length
          toast.success(
            `${approved ? 'Approved' : 'Un-approved'} ${n} record${n > 1 ? 's' : ''}.`
          )
          table.resetRowSelection()
        },
        // Surface the real reason. A success toast on failure would hide RLS
        // or network errors and leave the user believing data was written.
        onError: (err) => {
          toast.error(
            `Could not ${approved ? 'approve' : 'un-approve'}: ${
              err instanceof Error ? err.message : 'unknown error'
            }`
          )
        },
      }
    )
  }

  function handleExportSelected() {
    if (selectedTasks.length === 0) return
    downloadCsv(
      tasksToCsv(selectedTasks),
      `tms-export-selected-${new Date().toISOString().slice(0, 10)}.csv`
    )
    const n = selectedTasks.length
    toast.success(`Exported ${n} record${n > 1 ? 's' : ''} to CSV.`)
    table.resetRowSelection()
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='task'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => handleApprove(true)}
              className='size-8'
              aria-label='Approve selected records'
              title='Approve selected'
              disabled={approveTasks.isPending}
            >
              <Check />
              <span className='sr-only'>Approve selected</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Approve selected for TMS export</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => handleApprove(false)}
              className='size-8'
              aria-label='Undo approve for selected records'
              title='Undo approve'
              disabled={approveTasks.isPending}
            >
              <Undo2 />
              <span className='sr-only'>Undo approve</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Undo approve</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={handleExportSelected}
              className='size-8'
              aria-label='Export selected records'
              title='Export selected'
            >
              <Download />
              <span className='sr-only'>Export selected</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Export selected to CSV</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='Delete selected records'
              title='Delete selected'
            >
              <Trash2 />
              <span className='sr-only'>Delete selected</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete selected</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <TasksMultiDeleteDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        table={table}
      />
    </>
  )
}
