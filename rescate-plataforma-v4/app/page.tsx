'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Camera, CheckCircle2, ChevronRight, Clock3, Heart, Leaf, LocateFixed, LogOut, MapPin, Menu, Package, Plus, QrCode, Search, ShieldCheck, Truck, Users, X, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { authClient, useSession } from '@/lib/auth-client'
import { Phase3Tools } from '@/components/phase3-tools'

const categories = ['Todas', 'Frutas y verduras', 'Panadería', 'Comida preparada', 'Lácteos']
type Role = 'donor' | 'receiver' | 'admin'
type Profile = { id: string; name: string; email: string; role: Role; organizationName: string | null; taxId?: string | null; verificationStatus: string; latitude: number | null; longitude: number | null; phone?: string | null; district?: string | null; bio?: string | null; privacyConsent?: boolean; privacyConsentAt?: string | null }
type Donation = { id: string; title: string; donor: string; donorId?: string; category: string; quantity: string; quantityKg?: number | string | null; pickupAddress: string; imageUrl?: string | null; availableFrom?: string; foodExpiresAt?: string | null; expiresAt: string; status: string; createdAt: string; distanceKm?: number | string | null; ratingAverage?: number | string | null; ratingCount?: number | string | null; donationRatingAverage?: number | string | null; donationRatingCount?: number | string | null }
type Reservation = { id: string; donationId: string; status: string; donationTitle: string; pickupAddress: string; quantity: string; quantityKg?: number | string | null; availableFrom?: string; foodExpiresAt?: string | null; pickupDeadline?: string; createdAt: string; completedAt?: string | null; expiresAt?: string | null; qrToken?: string; pickupCode?: string; receiverName?: string; ratingAverage?: number | string | null; ratingCount?: number | string | null; myRating?: number | null }
type OwnDonation = Donation & { receiverName?: string | null }
type NotificationItem = { id:string; type:string; title:string; message:string; readAt:string|null; createdAt:string }
type Metrics = { activeDonations: number; rescuesInProgress: number; connectedOrganizations: number; beneficiaries: number; rescuedLots: number; rescuedKg?: number; cancelledReservations?: number; rescueRate: number; role: Role; verificationStatus: string }

function expiry(value: string) { return new Date(value).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
function toLocalDateTime(value?: string | null) { const d = value ? new Date(value) : new Date(); if (Number.isNaN(d.valueOf())) return ''; return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
function timeLeft(value: string, now: number) { if (!now) return 'Calculando…'; const ms = new Date(value).getTime() - now; if (ms <= 0) return 'Vencido'; const totalMin = Math.floor(ms / 60000); const hours = Math.floor(totalMin / 60); const minutes = totalMin % 60; return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min` }
function roleLabel(role: Role) { return role === 'donor' ? 'Donante' : role === 'receiver' ? 'Receptor' : 'Administrador' }

export default function Page() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [donations, setDonations] = useState<Donation[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [ownDonations, setOwnDonations] = useState<OwnDonation[]>([])
  const [metrics, setMetrics] = useState<Metrics>({ activeDonations: 0, rescuesInProgress: 0, connectedOrganizations: 0, beneficiaries: 0, rescuedLots: 0, rescueRate: 0, role: 'receiver', verificationStatus: 'pending' })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todas')
  const [radius, setRadius] = useState(15)
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(null)
  const [active, setActive] = useState('inicio')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', category: 'Frutas y verduras', quantity: '', quantityKg: '', pickupAddress: '', availableFrom: '', foodExpiresAt: '', expiresAt: '', latitude: '', longitude: '' })
  const [editingDonationId, setEditingDonationId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: '', category: 'Frutas y verduras', quantity: '', quantityKg: '', pickupAddress: '', availableFrom: '', foodExpiresAt: '', expiresAt: '' })
  const [now, setNow] = useState(0)
  const [locationSaved, setLocationSaved] = useState(false)
  const [nearbyOnly, setNearbyOnly] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [reviewModal, setReviewModal] = useState<{ donationId:string; title:string; average:number; count:number; reviews:{id:string;rating:number;comment:string|null;fromName:string;createdAt:string}[] } | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)

  useEffect(() => { if (!isPending && !session?.user) router.replace('/sign-in') }, [isPending, session, router])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); setNow(Date.now()); return () => window.clearInterval(timer) }, [])
  useEffect(() => { setForm(f => ({ ...f, availableFrom: f.availableFrom || toLocalDateTime() })) }, [])
  useEffect(() => { if (!success) return; const timer = window.setTimeout(() => setSuccess(''), 5000); return () => window.clearTimeout(timer) }, [success])

  const load = useCallback(async () => {
    const profileRes = await fetch('/api/profile', { cache: 'no-store' })
    if (profileRes.status === 401) { router.replace('/sign-in'); return }
    const profileJson = await profileRes.json(); setProfile(profileJson.data)
    const p = profileJson.data as Profile
    setLocationSaved(p.latitude != null && p.longitude != null)
    if (p.privacyConsent !== true || p.verificationStatus === 'suspended') return
    const lat = location?.lat ?? p.latitude; const lng = location?.lng ?? p.longitude
    const donationUrl = p.role === 'receiver' && nearbyOnly && lat != null && lng != null ? `/api/donations?lat=${lat}&lng=${lng}&radius=${radius}` : '/api/donations'
    const requests: Promise<Response>[] = [fetch('/api/dashboard', { cache: 'no-store' }), fetch('/api/notifications', { cache: 'no-store' })]
    if (p.role === 'receiver') requests.push(fetch('/api/reservations', { cache: 'no-store' }), fetch(donationUrl, { cache: 'no-store' }))
    if (p.role === 'donor') requests.push(fetch('/api/my-donations', { cache: 'no-store' }), fetch('/api/reservations', { cache: 'no-store' }))
    const responses = await Promise.all(requests)
    if (responses.some(r => r.status === 401)) { router.replace('/sign-in'); return }
    const metricsJson = await responses[0].json(); setMetrics(metricsJson.data)
    const notificationsJson = await responses[1].json(); setNotifications(notificationsJson.data ?? [])
    if (p.role === 'receiver') {
      const reservationsJson = await responses[2].json()
      const donationsJson = await responses[3].json()
      if (!responses[2].ok) throw new Error(reservationsJson.error || 'No se pudieron cargar las reservas.')
      if (!responses[3].ok) throw new Error(donationsJson.error || 'No se pudieron cargar las donaciones.')
      setReservations(reservationsJson.data ?? [])
      setDonations(donationsJson.data ?? [])
    }
    if (p.role === 'donor') { setOwnDonations((await responses[2].json()).data ?? []); setReservations((await responses[3].json()).data ?? []) }
  }, [router, location?.lat, location?.lng, radius, nearbyOnly])

  useEffect(() => {
    if (!session?.user) return
    void load().catch(e => setError(e instanceof Error ? e.message : 'No pudimos cargar la plataforma.'))
  }, [session?.user, load])

  useEffect(() => {
    if (!session?.user) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load().catch(console.error)
    }, 15000)
    return () => window.clearInterval(timer)
  }, [session?.user, load])

  function go(id: string) { setActive(id); setMobileOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
  function useLocation() {
    setError('')
    if (!navigator.geolocation) { setError('Este navegador no permite geolocalización.'); return }
    navigator.geolocation.getCurrentPosition(async pos => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      try {
        const response = await fetch('/api/profile', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(loc) })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'No se pudo guardar la ubicación.')
        setLocation(loc)
        setLocationSaved(true)
        setForm(f => ({ ...f, latitude: String(loc.lat), longitude: String(loc.lng) }))
        setSuccess('Ubicación actualizada correctamente.')
      } catch (error) {
        setError(error instanceof Error ? error.message : 'No se pudo guardar la ubicación.')
      }
    }, () => setError('No pudimos obtener tu ubicación. Revisa los permisos del navegador.'), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 })
  }

  async function reserve(id: string) { setBusy(id); setError(''); try { const r = await fetch('/api/reservations', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ donationId:id }) }); const j=await r.json(); if(!r.ok) throw new Error(j.error); setSuccess('Lote reservado. Ya tienes tu código de recojo.'); await load(); go('reservas') } catch(e){setError(e instanceof Error?e.message:'No fue posible reservar.')} finally{setBusy(null)} }
  async function cancel(id: string) { setBusy(id); try { const r=await fetch('/api/reservations',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({reservationId:id})}); const j=await r.json(); if(!r.ok) throw new Error(j.error); await load() } catch(e){setError(e instanceof Error?e.message:'No fue posible cancelar.')} finally{setBusy(null)} }
  async function publish(e: FormEvent) {
    e.preventDefault()
    if (busy === 'publish') return
    setError('')
    const latitude = form.latitude.trim() ? Number(form.latitude) : (location?.lat ?? profile?.latitude)
    const longitude = form.longitude.trim() ? Number(form.longitude) : (location?.lng ?? profile?.longitude)
    if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Guarda la ubicación del punto de recojo antes de publicar.'); return
    }
    const dates = [form.availableFrom, form.foodExpiresAt, form.expiresAt].map(v => new Date(v))
    if (dates.some(d => Number.isNaN(d.getTime()))) { setError('Completa las fechas de disponibilidad y vencimiento.'); return }
    if (dates[1] <= dates[0] || dates[2] <= dates[0] || dates[2] > dates[1]) {
      setError('Revisa las fechas: el recojo debe ocurrir durante la disponibilidad y antes del vencimiento del alimento.'); return
    }
    setBusy('publish')
    const payload = { ...form, availableFrom: dates[0].toISOString(), foodExpiresAt: dates[1].toISOString(), expiresAt: dates[2].toISOString(), quantityKg: form.quantityKg.trim() ? Number(form.quantityKg) : null, latitude, longitude, imageUrl: photo }
    try {
      const response = await fetch('/api/donations', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo publicar el lote.')
      setSuccess('Lote publicado correctamente.')
      setForm({title:'',category:'Frutas y verduras',quantity:'',quantityKg:'',pickupAddress:'',availableFrom:toLocalDateTime(),foodExpiresAt:'',expiresAt:'',latitude:'',longitude:''})
      setPhoto(null)
      await load()
      go('mis-donaciones')
    } catch (error) { setError(error instanceof Error ? error.message : 'No fue posible publicar.') }
    finally { setBusy(null) }
  }

  function startEdit(d: OwnDonation) { setEditingDonationId(d.id); setEditForm({ title:d.title, category:d.category, quantity:d.quantity, quantityKg:d.quantityKg == null ? '' : String(d.quantityKg), pickupAddress:d.pickupAddress, availableFrom:toLocalDateTime(d.availableFrom), foodExpiresAt:toLocalDateTime(d.foodExpiresAt), expiresAt:toLocalDateTime(d.expiresAt) }) }
  async function saveEdit(e: FormEvent) { e.preventDefault(); if(!editingDonationId)return; setBusy('edit'); setError(''); try { const payload={ donationId:editingDonationId, ...editForm, quantityKg:editForm.quantityKg.trim()?Number(editForm.quantityKg):null, availableFrom:new Date(editForm.availableFrom).toISOString(), foodExpiresAt:new Date(editForm.foodExpiresAt).toISOString(), expiresAt:new Date(editForm.expiresAt).toISOString() }; const r=await fetch('/api/donations',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const j=await r.json(); if(!r.ok) throw new Error(j.error||'No fue posible editar el lote.'); setSuccess('Lote actualizado.'); setEditingDonationId(null); await load() } catch(e){setError(e instanceof Error?e.message:'No fue posible editar el lote.')} finally{setBusy(null)} }
  async function validateToken(token: string) { if(!token) return; setBusy('validate'); setError(''); try { const r=await fetch('/api/reservations/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}); const j=await r.json(); if(!r.ok) throw new Error(j.error); setSuccess(`Entrega validada: ${j.data.donationTitle}.`); setManualCode(''); setScannerOpen(false); await load() } catch(e){setError(e instanceof Error?e.message:'Código no válido.')} finally{setBusy(null)} }
  async function validateCode(code: string) { if(!/^\d{6}$/.test(code)) { setError('Ingresa un código válido de seis dígitos.'); return } setBusy('validate'); setError(''); try { const r=await fetch('/api/reservations/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pickupCode:code})}); const j=await r.json(); if(!r.ok) throw new Error(j.error); setSuccess(`Entrega validada: ${j.data.donationTitle}.`); setManualCode(''); await load() } catch(e){setError(e instanceof Error?e.message:'Código no válido.')} finally{setBusy(null)} }
  async function openDonationReviews(item: Donation) { setReviewLoading(true); setError(''); try { if(!item.donorId) throw new Error('No se encontró el donante.'); const r=await fetch(`/api/users/${item.donorId}/reviews`,{cache:'no-store'}); const j=await r.json(); if(!r.ok) throw new Error(j.error||'No pudimos cargar las calificaciones.'); setReviewModal({ donationId:item.id, title:`Reputación de ${item.donor}`, average:Number(j.summary?.average||0), count:Number(j.summary?.total||0), reviews:j.data||[] }) } catch(e){setError(e instanceof Error?e.message:'No pudimos cargar las calificaciones.')} finally{setReviewLoading(false)} }
  async function acceptPrivacyConsent() {
    setBusy('privacy-consent'); setError('')
    try {
      const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ privacyConsent: true }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo registrar el consentimiento.')
      setProfile(result.data as Profile)
      await load()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo registrar el consentimiento.')
    } finally { setBusy(null) }
  }

  async function signOut(){await authClient.signOut();router.replace('/sign-in')}

  const filtered = useMemo(() => donations.filter(d => `${d.title} ${d.donor} ${d.category}`.toLowerCase().includes(query.toLowerCase()) && (category==='Todas'||d.category===category)), [donations,query,category])
  if (isPending || !session?.user || !profile) return <div className="loading-screen">Cargando Rescate...</div>
  const initials = profile.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()
  const approved = profile.verificationStatus === 'approved'

  if (profile.privacyConsent !== true) return <main className="auth-page"><section className="auth-shell"><div className="auth-card"><p className="eyebrow">PRIVACIDAD Y DATOS PERSONALES</p><h1>Antes de continuar</h1><p>Para acceder a las funciones de Rescate, revisa el aviso de privacidad y registra tu decisión. Esto no sustituye la revisión legal que requiere el proyecto antes de un lanzamiento público.</p><p><a href="/privacidad" target="_blank" rel="noreferrer">Leer el aviso de privacidad</a></p>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" disabled={busy==='privacy-consent'} onClick={acceptPrivacyConsent}>{busy==='privacy-consent'?'Registrando...':'Acepto y continuar'}</button><button className="secondary-action" onClick={signOut}>No acepto · Cerrar sesión</button></div></section></main>

  if (profile.verificationStatus === 'suspended') return <main className="auth-page"><section className="auth-shell"><div className="auth-card"><p className="eyebrow">ACCESO RESTRINGIDO</p><h1>Cuenta suspendida</h1><p>La organización no puede operar temporalmente. Contacta al administrador por el canal oficial para conocer el motivo y solicitar una revisión.</p><button className="auth-submit" onClick={signOut}>Cerrar sesión</button></div></section></main>

  return <div className="rescue-app">
    <aside className={`rescue-sidebar ${mobileOpen?'open':''}`}>
      <div className="rescue-brand"><div className="rescue-logo"><Leaf size={20}/></div><div><strong>Rescate</strong><small>Red de alimentos</small></div><button className="close-menu" onClick={()=>setMobileOpen(false)}><X/></button></div>
      <div className="profile-card"><div className="profile-avatar">{initials}</div><div><small>{roleLabel(profile.role)}</small><strong>{profile.organizationName || profile.name}</strong></div><span className={`status-dot ${approved?'ok':''}`}/></div>
      <nav className="rescue-nav"><span className="nav-caption">OPERACIÓN</span>
        <button className={active==='inicio'?'active':''} onClick={()=>go('inicio')}><Package size={18}/><span>Resumen</span></button>
        {profile.role==='receiver' && <><button className={active==='donaciones'?'active':''} onClick={()=>go('donaciones')}><Search size={18}/><span>Donaciones cercanas</span><b>{metrics.activeDonations}</b></button><button className={active==='reservas'?'active':''} onClick={()=>go('reservas')}><QrCode size={18}/><span>Mis reservas</span></button></>}
        {profile.role==='donor' && <><button className={active==='publicar'?'active':''} onClick={()=>go('publicar')}><Plus size={18}/><span>Publicar lote</span></button><button className={active==='mis-donaciones'?'active':''} onClick={()=>go('mis-donaciones')}><Truck size={18}/><span>Mis donaciones</span></button><button className={active==='validar'?'active':''} onClick={()=>go('validar')}><Camera size={18}/><span>Validar recojo</span></button></>}
        {profile.role==='admin' && <button onClick={()=>router.push('/admin')}><ShieldCheck size={18}/><span>Panel administrativo</span></button>}
        <span className="nav-caption lower">CUENTA</span><button onClick={useLocation}><LocateFixed size={18}/><span>Actualizar ubicación</span></button><button onClick={signOut}><LogOut size={18}/><span>Cerrar sesión</span></button>
      </nav>
      <div className="sidebar-footer"><div className="impact-mini"><Leaf size={17}/><div><strong>Impacto medible</strong><small>{metrics.rescuedLots} rescates completados</small></div></div></div>
    </aside>
    {mobileOpen && <button className="mobile-overlay" onClick={()=>setMobileOpen(false)}/>}<main className="rescue-main">
      <header className="rescue-header"><button className="mobile-toggle" onClick={()=>setMobileOpen(true)}><Menu/></button><div className="crumb">Rescate <span>/</span><strong>{roleLabel(profile.role)}</strong></div><div className="header-actions"><span className="live-status"><i/> Plataforma activa</span><div className="notification-wrap"><button className="notification-button" onClick={async()=>{setNotificationsOpen(v=>!v);if(!notificationsOpen) await fetch('/api/notifications',{method:'PATCH'});}} aria-label="Notificaciones"><Bell size={19}/>{notifications.some(n=>!n.readAt)&&<span/>}</button>{notificationsOpen&&<div className="notification-panel"><strong>Centro de avisos</strong>{notifications.length?notifications.slice(0,8).map(n=><div className="notification-item" key={n.id}><span className={`notification-dot ${n.type==='warning'?'orange-dot':'green-dot'}`}/><div><b>{n.title}</b><small>{n.message}</small><small>{new Date(n.createdAt).toLocaleString('es-PE')}</small></div></div>):<div className="notification-item"><span className="notification-dot green-dot"/><div><b>Todo al día</b><small>No tienes nuevos avisos.</small></div></div>}</div>}</div><div className="header-avatar">{initials}</div></div></header>
      <div className="rescue-content">
        {!approved && profile.role!=='admin' && <div className="pending-banner"><ShieldCheck size={20}/><div><strong>Cuenta pendiente de validación</strong><p>Un administrador debe verificar la legitimidad de tu organización antes de publicar o reservar alimentos.</p></div></div>}
        {error && <div className="app-alert">{error}<button onClick={()=>setError('')}>×</button></div>}{success&&<div className="app-success"><CheckCircle2 size={17}/>{success}<button onClick={()=>setSuccess('')}>×</button></div>}
        <section id="inicio" className="welcome"><div><p className="eyebrow">{roleLabel(profile.role).toUpperCase()} · RESCATE DE MERMAS</p><h1>Hola, {profile.name.split(' ')[0]}.<br/><em>{profile.role==='donor'?'Dona antes de desperdiciar.':profile.role==='receiver'?'Rescatemos alimentos.':'Gestiona el rescate.'}</em></h1><p>{profile.role==='donor'?'Publica excedentes aptos en menos de dos minutos y valida el recojo con QR.':profile.role==='receiver'?'Encuentra lotes cercanos, reserva con seguridad y presenta tu QR al recoger.':'Valida organizaciones, supervisa lotes y controla la trazabilidad de la red.'}</p><div className="welcome-actions">{profile.role==='receiver'&&<button className="primary-action" onClick={()=>go('donaciones')}>Ver donaciones <ChevronRight size={16}/></button>}{profile.role==='donor'&&<button className="primary-action" onClick={()=>go('publicar')}><Plus size={16}/> Publicar lote</button>}{profile.role==='admin'&&<button className="primary-action" onClick={()=>router.push('/admin')}><ShieldCheck size={16}/> Abrir administración</button>}<button className="secondary-action" onClick={useLocation}><MapPin size={16}/> Usar mi ubicación</button></div></div><div className="welcome-art"><div className="art-circle"><Leaf size={72}/></div><div className="art-stat"><strong>{metrics.rescuedLots} rescates</strong><span>{metrics.rescueRate}% de tasa registrada</span></div></div></section>
        <section className="metric-row"><div><span className="metric-icon green"><Package/></span><div><strong>{metrics.activeDonations}</strong><small>Lotes disponibles</small><b>En tiempo real</b></div></div><div><span className="metric-icon orange"><Truck/></span><div><strong>{metrics.rescuesInProgress}</strong><small>Rescates en curso</small><b>Reservas activas</b></div></div><div><span className="metric-icon blue"><Users/></span><div><strong>{metrics.connectedOrganizations}</strong><small>Organizaciones aprobadas</small><b>Red activa</b></div></div><div><span className="metric-icon violet"><Heart/></span><div><strong>{metrics.rescuedLots}</strong><small>Entregas confirmadas</small><b>{metrics.rescueRate}% de rescate de la red</b></div></div></section>

        <section className="smart-strip"><div><span className={`smart-dot ${locationSaved?'ok':''}`}/><div><strong>{locationSaved ? 'Ubicación lista' : 'Ubicación pendiente'}</strong><small>{locationSaved ? 'Usaremos tu posición para ordenar los lotes cercanos.' : 'Actívala para aprovechar la búsqueda por proximidad.'}</small></div></div><div className="smart-strip-actions">{profile.role==='receiver' && <span className="mini-stat"><Search size={14}/> {metrics.activeDonations} lotes activos</span>}<button className="secondary-action compact-action" onClick={useLocation}><LocateFixed size={14}/> {locationSaved?'Actualizar':'Activar GPS'}</button></div></section>

        {profile.role==='receiver' && <section id="donaciones" className="donations-section"><div className="section-title"><div><p className="eyebrow">HU-02 · PROXIMIDAD</p><h2>Donaciones cercanas</h2><p>Explora los lotes disponibles y activa el filtro para ver los más cercanos.</p></div><div className="radius-control"><MapPin size={15}/><select value={radius} onChange={e=>setRadius(Number(e.target.value))}><option value={5}>5 km</option><option value={15}>15 km</option><option value={30}>30 km</option><option value={50}>50 km</option></select></div></div><div className="filters"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar alimento, comercio..."/></div><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></div><div className="location-filter-toggle"><button type="button" className={`secondary-action compact-action ${nearbyOnly?'active':''}`} onClick={()=>{ if (!nearbyOnly && !locationSaved && !location) { setError('Primero guarda tu ubicación para buscar por cercanía.'); return } setNearbyOnly(v=>!v) }}><MapPin size={15}/>{nearbyOnly?'Mostrar todos los lotes':'Filtrar por cercanía'}</button>{nearbyOnly&&<small>Radio: {radius} km · Para ver todos, desactiva el filtro.</small>}</div><div className="donation-grid">{filtered.length===0?<div className="empty-reservations wide-empty"><MapPin/><p>No encontramos lotes con estos filtros.</p><small>{nearbyOnly?'Prueba un radio mayor o desactiva el filtro de cercanía.':'Solo se muestran lotes disponibles o programados que no hayan vencido. Revisa las fechas y el estado del lote en Mis donaciones.'}</small><button className="secondary-action compact-action" onClick={useLocation}><LocateFixed size={14}/> Activar ubicación</button></div>:filtered.map((item,i)=><article className="donation-card" key={item.id}><div className={`donation-image ${['green','orange','blue','violet'][i%4]}`}>{item.imageUrl?<img src={item.imageUrl} alt=""/>:<Package size={42}/>}<span>{item.category}</span></div><div className="donation-body"><div className="card-heading"><div><h3>{item.title}</h3><p>{item.donor}</p></div><Heart size={18}/></div><div className="donation-details"><span><Package size={14}/>{item.quantity}</span><span><MapPin size={14}/>{nearbyOnly && item.distanceKm!=null?`${Number(item.distanceKm).toFixed(1)} km`:item.pickupAddress}</span><span><Clock3 size={14}/>Hasta {expiry(item.expiresAt)}</span><span className={now && new Date(item.expiresAt).getTime()-now<3600000?'urgent-time':''}><Clock3 size={14}/>{timeLeft(item.expiresAt,now)}</span></div><div className="donation-rating-row">{Number(item.ratingCount||0)>0?<button className="rating-badge" type="button" onClick={()=>openDonationReviews(item)} title="Ver calificaciones del donante"><Star size={14} fill="currentColor"/> {Number(item.ratingAverage||0).toFixed(1)} <span>({Number(item.ratingCount||0)} {Number(item.ratingCount||0)===1?'reseña':'reseñas'})</span></button>:<span className="no-rating">Aún sin calificaciones</span>}</div><div className="card-footer"><span className="available"><i/>{item.availableFrom&&new Date(item.availableFrom).getTime()>Date.now()?'Próximamente':'Disponible'}</span><button className="reserve-button" disabled={!['available','scheduled'].includes(item.status)||(item.availableFrom?new Date(item.availableFrom).getTime()>Date.now():false)||!approved||busy===item.id} onClick={()=>reserve(item.id)}>{item.availableFrom&&new Date(item.availableFrom).getTime()>Date.now()?'A partir de '+expiry(item.availableFrom):busy===item.id?'Reservando...':approved?'Reservar lote':'Pendiente de aprobación'}</button></div></div></article>)}</div></section>}

        {profile.role==='receiver' && <section id="reservas" className="lower-grid"><div className="reservation-panel"><div className="section-title compact"><div><p className="eyebrow">HU-03 · TRAZABILIDAD</p><h2>Mis reservas</h2></div></div>{reservations.length?<div className="reservation-list">{reservations.map(r=><ReservationCard key={r.id} reservation={r} busy={busy===r.id} onCancel={(id)=>{ void cancel(id) }}/>)}</div>:<div className="empty-reservations"><QrCode size={25}/><p>Aún no tienes reservas.</p><small>Reserva un lote y recibirás un QR único.</small></div>}</div><div className="impact-panel"><p className="eyebrow">TU IMPACTO</p><h2>Alimento rescatado con trazabilidad.</h2><div className="impact-number">{metrics.rescuedLots}<span> entregas</span></div><p>La entrega se cierra cuando el donante valida el QR.</p><div className="impact-bar"><span style={{width:`${Math.min(metrics.rescueRate,100)}%`}}/></div><small>Tasa registrada: {metrics.rescueRate}%</small></div></section>}

        {profile.role==='donor' && <section className="donor-impact-strip"><div><p className="eyebrow">IMPACTO DEL DONANTE</p><strong>{metrics.rescuedKg ? metrics.rescuedKg.toFixed(1) : '0'} kg</strong><span>rescatados</span></div><div><strong>{metrics.rescuedLots}</strong><span>entregas</span></div><div><strong>{metrics.rescueRate}%</strong><span>tasa de rescate</span></div><div><strong>{metrics.cancelledReservations||0}</strong><span>cancelaciones de red</span></div></section>}

        {profile.role==='donor' && <section id="publicar" className="publish-section"><div><p className="eyebrow">HU-01 · PUBLICACIÓN RÁPIDA</p><h2>Publica un lote en minutos</h2><p>Indica cuándo estará disponible, su vencimiento y el límite para recogerlo.</p></div><form className="publish-form" onSubmit={publish}><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej. Pan del día" maxLength={120} required/><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.slice(1).map(x=><option key={x}>{x}</option>)}</select><input value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="Cantidad, ej. 20 kg" maxLength={60} required/><label>Peso total en kg (opcional)<input type="number" min="0.01" max="1000000" step="0.01" value={form.quantityKg} onChange={e=>setForm({...form,quantityKg:e.target.value})} placeholder="Ej. 20.5"/></label><input value={form.pickupAddress} onChange={e=>setForm({...form,pickupAddress:e.target.value})} placeholder="Dirección de recojo" maxLength={240} required/><label>Disponible desde<input type="datetime-local" value={form.availableFrom} onChange={e=>setForm({...form,availableFrom:e.target.value})} required/></label><label>Vencimiento del alimento<input type="datetime-local" value={form.foodExpiresAt} min={form.availableFrom} onChange={e=>setForm({...form,foodExpiresAt:e.target.value})} required/></label><label>Límite para recoger<input type="datetime-local" value={form.expiresAt} min={form.availableFrom} max={form.foodExpiresAt||undefined} onChange={e=>setForm({...form,expiresAt:e.target.value})} required/></label>{photo&&<div className="photo-preview"><img src={photo} alt="Vista previa del lote"/><button type="button" onClick={()=>setPhoto(null)}>Quitar foto</button></div>}<input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={e=>{const file=e.target.files?.[0]; if(!file)return; if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('Usa una imagen PNG, JPEG o WebP.');e.currentTarget.value='';return} if(file.size>1800000){setError('La foto debe pesar menos de 1.8 MB.');e.currentTarget.value='';return} const reader=new FileReader(); reader.onload=()=>setPhoto(String(reader.result)); reader.readAsDataURL(file)}}/><div className={`location-helper ${locationSaved?'saved':''}`}><LocateFixed size={15}/><span>{locationSaved?'Ubicación guardada para este punto de recojo.':'La ubicación es obligatoria para publicar y aparecer en búsquedas cercanas.'}</span></div><button type="button" className="secondary-action" onClick={useLocation}><LocateFixed size={15}/> {locationSaved?'Actualizar ubicación':'Guardar ubicación actual'}</button><button className="primary-action" disabled={!approved||busy==='publish'}>{busy==='publish'?'Publicando...':approved?'Publicar donación':'Esperando aprobación'}</button></form></section>}

        {profile.role==='donor' && <section id="mis-donaciones" className="donor-panel"><div className="section-title"><div><p className="eyebrow">CONTROL DEL DONANTE</p><h2>Mis donaciones</h2><p>Los lotes se pueden editar o cancelar si aún no tienen una reserva activa.</p></div></div>{editingDonationId&&<form className="publish-form" onSubmit={saveEdit} style={{marginBottom:20}}><h3>Editar lote</h3><input value={editForm.title} onChange={e=>setEditForm({...editForm,title:e.target.value})} placeholder="Nombre del lote" maxLength={120} required/><select value={editForm.category} onChange={e=>setEditForm({...editForm,category:e.target.value})}>{categories.slice(1).map(x=><option key={x}>{x}</option>)}</select><input value={editForm.quantity} onChange={e=>setEditForm({...editForm,quantity:e.target.value})} placeholder="Cantidad" maxLength={60} required/><label>Peso total en kg (opcional)<input type="number" min="0.01" max="1000000" step="0.01" value={editForm.quantityKg} onChange={e=>setEditForm({...editForm,quantityKg:e.target.value})} placeholder="Ej. 20.5"/></label><input value={editForm.pickupAddress} onChange={e=>setEditForm({...editForm,pickupAddress:e.target.value})} placeholder="Dirección de recojo" maxLength={240} required/><label>Disponible desde<input type="datetime-local" value={editForm.availableFrom} onChange={e=>setEditForm({...editForm,availableFrom:e.target.value})} required/></label><label>Vencimiento del alimento<input type="datetime-local" value={editForm.foodExpiresAt} min={editForm.availableFrom} onChange={e=>setEditForm({...editForm,foodExpiresAt:e.target.value})} required/></label><label>Límite para recoger<input type="datetime-local" value={editForm.expiresAt} min={editForm.availableFrom} max={editForm.foodExpiresAt||undefined} onChange={e=>setEditForm({...editForm,expiresAt:e.target.value})} required/></label><div className="welcome-actions"><button className="primary-action" disabled={busy==='edit'}>{busy==='edit'?'Guardando...':'Guardar cambios'}</button><button type="button" className="secondary-action" onClick={()=>setEditingDonationId(null)}>Cancelar edición</button></div></form>}<div className="table-list">{ownDonations.length?ownDonations.map(d=><div className="donor-row" key={d.id}><div className="mini-thumb">{d.imageUrl?<img src={d.imageUrl} alt=""/>:<Package size={20}/>}</div><div><strong>{d.title}</strong><small>{d.quantity}{d.quantityKg != null ? ` · ${Number(d.quantityKg).toFixed(2)} kg` : ''} · recojo hasta {expiry(d.expiresAt)}{d.foodExpiresAt?` · alimento vence ${expiry(d.foodExpiresAt)}`:''}</small></div><span className={`status-pill ${d.status}`}>{d.status==='available'?'Disponible':d.status==='scheduled'?'Programado':d.status==='reserved'?'Reservado':d.status==='delivered'?'Entregado':d.status==='expired'?'Vencido':d.status==='cancelled'?'Cancelado':d.status}</span><span className="receiver-cell">{d.receiverName||'—'}</span><span className="donor-rating-cell">{Number(d.ratingCount||0)>0?<><Star size={13} fill="currentColor"/> {Number(d.ratingAverage||0).toFixed(1)} <small>({Number(d.ratingCount||0)})</small></>:<small>Sin reseñas</small>}</span>{['available','scheduled'].includes(d.status)&&<button className="text-link cancel-link" disabled={busy===d.id} onClick={()=>startEdit(d)}>Editar</button>}{['available','scheduled'].includes(d.status)&&<button className="text-link cancel-link" disabled={busy===d.id} onClick={async()=>{setBusy(d.id);try{const r=await fetch('/api/donations',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({donationId:d.id})});const j=await r.json();if(!r.ok)throw new Error(j.error);setSuccess('Publicación cancelada.');await load()}catch(e){setError(e instanceof Error?e.message:'No fue posible cancelar')}finally{setBusy(null)}}}>{busy===d.id?'...':'Cancelar'}</button>}</div>):<div className="empty-reservations"><p>Aún no has publicado lotes.</p></div>}</div></section>}

        {profile.role==='donor' && <section id="validar" className="validator-panel"><div><p className="eyebrow">HU-04 · CONFIRMACIÓN DE RECOJO</p><h2>Validar entrega</h2><p>Escanea el QR del receptor o ingresa el código de 6 dígitos como respaldo.</p></div><div className="validator-actions"><button className="primary-action" disabled={!approved} onClick={()=>setScannerOpen(true)}><Camera size={17}/> Escanear QR</button><div className="manual-code"><input maxLength={6} inputMode="numeric" value={manualCode} onChange={e=>setManualCode(e.target.value.replace(/\D/g,''))} placeholder="000000"/><button className="secondary-action" disabled={!approved||manualCode.length!==6||busy==='validate'} onClick={()=>validateCode(manualCode)}>{busy==='validate'?'Validando...':'Validar código'}</button></div></div></section>}

        <Phase3Tools profile={profile} reservations={reservations} onSaved={()=>load()}/><footer className="rescue-footer"><div><strong>Rescate</strong><span>Red de redistribución de alimentos</span></div><div><span>ODS 2 · ODS 12</span><span>Concurrencia · QR · Haversine</span></div></footer>
      </div>
    </main>
    {reviewModal && <DonationReviewsModal reviewModal={reviewModal} loading={reviewLoading} onClose={()=>setReviewModal(null)}/>}
    {scannerOpen && <QrScanner onClose={()=>setScannerOpen(false)} onScan={validateToken}/>} 
  </div>
}

function ReservationCard({ reservation:r, busy, onCancel }:{reservation:Reservation;busy:boolean;onCancel:(id:string)=>void}) {
  const [qr,setQr]=useState('')
  useEffect(()=>{ if(r.qrToken) import('qrcode').then(mod=>mod.toDataURL(r.qrToken!,{width:180,margin:2})).then(setQr).catch(()=>{}) },[r.qrToken])
  return <div className="reservation-success"><div className="success-icon"><CheckCircle2/></div><div className="reservation-info"><strong>{r.donationTitle}</strong><p>{r.quantity}{r.quantityKg != null ? ` · ${Number(r.quantityKg).toFixed(2)} kg` : ''} · {r.pickupAddress}</p><small>{r.status==='completed'?'Entrega confirmada':r.status==='requested'||r.status==='confirmed'?`En curso · Presenta tu QR o código ${r.pickupCode || ''}`:r.status==='cancelled'?'Reserva cancelada':r.status==='expired'?'Reserva vencida':`Estado: ${r.status}`}</small>{r.status==='completed'&&<div className="reservation-rating">{Number(r.ratingCount||0)>0?<><Star size={13} fill="currentColor"/> {Number(r.ratingAverage||0).toFixed(1)} <span>({Number(r.ratingCount||0)} reseñas)</span></>:<span>Aún sin calificaciones</span>}</div>}{qr&&r.status==='requested'&&<img className="qr-image" src={qr} alt="Código QR de recojo"/>}</div>{r.status==='requested'&&<button className="text-link cancel-link" disabled={busy} onClick={()=>onCancel(r.id)}>{busy?'...':'Cancelar'}</button>}</div>
}

function DonationReviewsModal({reviewModal,onClose,loading}:{reviewModal:{title:string;average:number;count:number;reviews:{id:string;rating:number;comment:string|null;fromName:string;createdAt:string}[]};onClose:()=>void;loading:boolean}) {
  return <div className="modal-backdrop"><div className="review-modal"><button className="modal-close" onClick={onClose}><X/></button><p className="eyebrow">REPUTACIÓN DEL RESCATE</p><h2>{reviewModal.title}</h2><div className="review-modal-summary"><div><strong>{reviewModal.count?reviewModal.average.toFixed(1):'—'}</strong><span>/ 5</span><small>{reviewModal.count} {reviewModal.count===1?'reseña':'reseñas'}</small></div><div className="stars">{'★★★★★'.split('').map((s,i)=><span key={i} className={i<Math.round(reviewModal.average)?'on':''}>{s}</span>)}</div></div>{loading?<p className="muted-copy">Cargando calificaciones...</p>:reviewModal.reviews.length?<div className="review-modal-list">{reviewModal.reviews.map(r=><div key={r.id}><div className="review-modal-head"><strong>{r.fromName}</strong><span>{'★'.repeat(r.rating)}</span></div><small>{new Date(r.createdAt).toLocaleDateString('es-PE')}</small><p>{r.comment||'Sin comentario.'}</p></div>)}</div>:<div className="empty-reservations"><Star/><p>Aún no hay reseñas para este rescate.</p></div>}</div></div>
}

function QrScanner({onClose,onScan}:{onClose:()=>void;onScan:(token:string)=>void}) {
  useEffect(()=>{ let scanner:any; let stopped=false; import('html5-qrcode').then(({Html5Qrcode})=>{ if(stopped)return; scanner=new Html5Qrcode('qr-reader'); scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:250}},(decoded:string)=>{scanner.stop().catch(()=>{});onScan(decoded)},()=>{}).catch(()=>{}) }); return()=>{stopped=true; if(scanner)scanner.stop().catch(()=>{})} },[onScan])
  return <div className="modal-backdrop"><div className="qr-modal"><button className="modal-close" onClick={onClose}><X/></button><p className="eyebrow">LECTOR QR</p><h2>Escanea el código del receptor</h2><div id="qr-reader" className="qr-reader"/><p>Si la cámara falla, usa el código manual de 6 dígitos.</p></div></div>
}
