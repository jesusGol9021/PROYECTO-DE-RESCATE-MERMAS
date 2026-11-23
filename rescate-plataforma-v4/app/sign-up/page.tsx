import Link from 'next/link'
import { Leaf, ShieldCheck } from 'lucide-react'
import { AuthForm } from '@/components/auth-form'

export default function SignUpPage() {
  return <main className="auth-page"><section className="auth-shell"><div className="auth-brand"><span className="rescue-logo"><Leaf size={20} /></span><div><strong>Rescate</strong><small>Red de redistribución de alimentos</small></div></div><div className="auth-card"><div className="auth-card-heading"><span className="auth-badge"><ShieldCheck size={16} /> Registro seguro</span><h1>Únete a la red</h1><p>Crea una cuenta para publicar excedentes o coordinar rescates.</p></div><AuthForm mode="sign-up" /><p className="auth-switch">¿Ya tienes una cuenta? <Link href="/sign-in">Iniciar sesión</Link></p></div><p className="auth-note">Al registrarte aceptas participar responsablemente en la redistribución de alimentos.</p></section></main>
}
