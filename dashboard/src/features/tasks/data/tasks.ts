import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, PRODUCT_ID } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { type Task } from './schema'

async function writeAudit(action: string, entity: string, entityId: string, userId: string) {
  try {
    await supabase.from('audit_log').insert({
      product_id: PRODUCT_ID,
      customer_id: userId,
      action,
      entity,
      entity_id: entityId,
    })
  } catch {}
}

const RECORD_COLUMNS =
  'id, title, status, label, priority, details, source_file_path, due_date, approved_at'

async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('records')
    .select(RECORD_COLUMNS)
    .eq('product_id', PRODUCT_ID)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: row.title,
    status: row.status,
    label: row.label ?? '',
    priority: row.priority ?? '',
    details: row.details ?? null,
    source_file_path: row.source_file_path ?? null,
    due_date: row.due_date ?? null,
    approved_at: row.approved_at ?? null,
  }))
}

export function useTasks() {
  return useQuery({
    queryKey: ['tasks', PRODUCT_ID],
    queryFn: fetchTasks,
  })
}

// Approved records only, oldest approval first so the export order matches the
// order the user reviewed them. RLS already restricts this to the caller's rows.
export async function fetchApprovedTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('records')
    .select(RECORD_COLUMNS)
    .eq('product_id', PRODUCT_ID)
    .not('approved_at', 'is', null)
    .order('approved_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: row.title,
    status: row.status,
    label: row.label ?? '',
    priority: row.priority ?? '',
    details: row.details ?? null,
    source_file_path: row.source_file_path ?? null,
    due_date: row.due_date ?? null,
    approved_at: row.approved_at ?? null,
  }))
}

async function setApproved(ids: string[], approved: boolean): Promise<void> {
  const { error } = await supabase
    .from('records')
    .update({ approved_at: approved ? new Date().toISOString() : null })
    .in('id', ids)
    .eq('product_id', PRODUCT_ID)

  if (error) throw error
}

export function useApproveTasks() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  return useMutation({
    mutationFn: ({ ids, approved }: { ids: string[]; approved: boolean }) =>
      setApproved(ids, approved),
    onSuccess: (_, { ids, approved }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', PRODUCT_ID] })
      if (user?.id) {
        ids.forEach((id) =>
          void writeAudit(
            approved ? 'record.approved' : 'record.unapproved',
            'record',
            id,
            user.id
          )
        )
      }
    },
  })
}

async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('records')
    .delete()
    .eq('id', id)
    .eq('product_id', PRODUCT_ID)

  if (error) throw error
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', PRODUCT_ID] })
      if (user?.id) void writeAudit('record.deleted', 'record', id, user.id)
    },
  })
}

async function deleteTasks(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('records')
    .delete()
    .in('id', ids)
    .eq('product_id', PRODUCT_ID)

  if (error) throw error
}

export function useDeleteTasks() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  return useMutation({
    mutationFn: deleteTasks,
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', PRODUCT_ID] })
      if (user?.id) {
        ids.forEach(id => void writeAudit('record.deleted', 'record', id, user.id))
      }
    },
  })
}

type UpsertTaskInput = Partial<Task> & { title: string; status: string }

async function upsertTask(
  task: UpsertTaskInput,
  customerId: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    title: task.title,
    status: task.status,
    label: task.label || null,
    priority: task.priority || null,
    product_id: PRODUCT_ID,
    customer_id: customerId,
  }
  if (task.id) payload.id = task.id

  const { error } = await supabase.from('records').upsert(payload)

  if (error) throw error
}

export function useUpsertTask() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  return useMutation({
    mutationFn: (task: UpsertTaskInput) => {
      if (!user) throw new Error('Not authenticated')
      return upsertTask(task, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', PRODUCT_ID] })
    },
  })
}

type ImportTaskRow = {
  title: string
  status: string
  label?: string
  priority?: string
}

async function importTasks(
  rows: ImportTaskRow[],
  customerId: string
): Promise<number> {
  const payload = rows.map((row) => ({
    title: row.title,
    status: row.status,
    label: row.label || null,
    priority: row.priority || null,
    product_id: PRODUCT_ID,
    customer_id: customerId,
  }))

  const { error } = await supabase.from('records').insert(payload)

  if (error) throw error
  return payload.length
}

export function useImportTasks() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  return useMutation({
    mutationFn: (rows: ImportTaskRow[]) => {
      if (!user) throw new Error('Not authenticated')
      return importTasks(rows, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', PRODUCT_ID] })
    },
  })
}
