import Link from 'next/link'
import { Leaf, ShieldCheck } from 'lucide-react'
import { AuthForm } from '@/components/auth-form'

export default function SignInPage() {
  return <main className="auth-page"><section className="auth-shell"><div className="auth-brand"><span className="rescue-logo"><Leaf size={20} /></span><div><strong>Rescate</strong><small>Red de redistribución de alimentos</small></div></div><div className="auth-card"><div className="auth-card-heading"><span className="auth-badge"><ShieldCheck size={16} /> Acceso protegido</span><h1>Bienvenido de vuelta</h1><p>Ingresa para gestionar donaciones, reservas y rescates de alimentos.</p></div><AuthForm mode="sign-in" /><p className="auth-switch">¿Aún no tienes una cuenta? <Link href="/sign-up">Crear cuenta</Link></p></div><p className="auth-note">Tus datos se protegen con sesiones seguras y cifrado de contraseñas.</p></section></main>
}
