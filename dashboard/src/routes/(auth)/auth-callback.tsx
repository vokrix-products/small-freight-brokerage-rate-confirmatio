import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/(auth)/auth-callback')({
  component: AuthCallback,
})

function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const error = params.get('error')
    const errorDescription = params.get('error_description')

    const finish = (ok: boolean) => navigate({ to: ok ? '/' : '/sign-up' })

    if (error) {
      console.error('auth callback error:', errorDescription || error)
      finish(false)
      return
    }

    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token })
        .then(({ data }) => finish(!!data.session))
        .catch(() => finish(false))
      return
    }

    // PKCE code exchange fallback (query param instead of hash)
    const query = new URLSearchParams(window.location.search)
    const code = query.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data }) => finish(!!data.session))
        .catch(() => finish(false))
      return
    }

    // No tokens in URL — check if the client already restored a session
    supabase.auth.getSession().then(({ data }) => finish(!!data.session))
  }, [navigate])
  return (
    <div className='flex h-screen items-center justify-center'>
      <p className='text-muted-foreground'>Signing you in...</p>
    </div>
  )
}
