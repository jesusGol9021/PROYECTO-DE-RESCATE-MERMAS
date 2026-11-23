'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<'donor' | 'receiver'>('receiver')
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const data = new FormData(event.currentTarget)
    const result = isSignUp
      ? await authClient.signUp.email({ name: String(data.get('name')), email: String(data.get('email')), password: String(data.get('password')), privacyConsent: data.get('privacyConsent') === 'on' })
      : await authClient.signIn.email({ email: String(data.get('email')), password: String(data.get('password')) })
    setLoading(false)
    if (result.error) { setError('No pudimos completar el acceso. Revisa tus datos e inténtalo nuevamente.'); return }
    if (isSignUp) {
      const profileResponse = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, organizationName: String(data.get('name')) }) })
      if (!profileResponse.ok) { setError('La cuenta se creó, pero no pudimos configurar el rol. Ingresa nuevamente para corregirlo.'); return }
    }
    router.push('/')
    router.refresh()
  }

  return <form className="auth-form" onSubmit={handleSubmit}>
    {isSignUp && <><label>Nombre de la organización<input name="name" required autoComplete="organization" placeholder="Organización Manos Unidas" /></label><label>Tipo de cuenta<select value={role} onChange={(e) => setRole(e.target.value as 'donor' | 'receiver')}><option value="receiver">Receptor · comedor / ONG / albergue</option><option value="donor">Donante · restaurante / supermercado / panadería</option></select></label><label className="privacy-consent"><input type="checkbox" name="privacyConsent" required /> He leído el <a href="/privacidad" target="_blank" rel="noreferrer">aviso de privacidad</a> y consiento el tratamiento de mis datos para gestionar mi cuenta y las operaciones de Rescate.</label></>}
    <label>Correo electrónico<input name="email" type="email" required autoComplete="email" placeholder="equipo@organizacion.org" /></label>
    <label>Contraseña<input name="password" type="password" required minLength={8} autoComplete={isSignUp ? 'new-password' : 'current-password'} placeholder="Mínimo 8 caracteres" /></label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="auth-submit" disabled={loading}>{loading ? 'Procesando...' : isSignUp ? 'Crear cuenta segura' : 'Iniciar sesión'}</button>
  </form>
}
