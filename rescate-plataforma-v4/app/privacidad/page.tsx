import Link from 'next/link'

export default function PrivacyPage() {
  const controller = process.env.PRIVACY_CONTROLLER_NAME?.trim() || '[COMPLETAR CON LA RAZÓN SOCIAL O RESPONSABLE DEL PROYECTO]'
  const contact = process.env.PRIVACY_CONTACT_EMAIL?.trim() || '[COMPLETAR CON UN CORREO INSTITUCIONAL VÁLIDO]'
  return <main className="auth-page"><section className="auth-shell"><div className="auth-card"><h1>Aviso de privacidad de Rescate</h1><p>Este aviso explica, a nivel de la aplicación, el tratamiento previsto de los datos. Antes de abrir Rescate a usuarios reales, el responsable de la organización debe completar sus datos de identificación y contacto y revisar legalmente este texto.</p>
  <h2>Responsable y contacto</h2><p>Responsable del tratamiento: <strong>{controller}</strong>.</p><p>Correo para consultas y ejercicio de derechos: <strong>{contact}</strong>.</p>
  <h2>Datos tratados</h2><p>La plataforma puede tratar nombre, correo, organización, perfil, teléfono o distrito si se proporcionan, ubicación del punto operativo, documentos de verificación, donaciones, reservas, validaciones de entrega, calificaciones, incidencias y registros de auditoría.</p>
  <h2>Finalidades</h2><p>Crear y proteger cuentas, verificar organizaciones, publicar y reservar lotes, coordinar y validar entregas, prevenir abusos, atender incidencias y generar reportes operativos.</p>
  <h2>Ubicación y documentos</h2><p>La ubicación se utiliza para funciones de proximidad y localización de puntos de recojo. Los documentos se utilizan para la verificación administrativa. No publiques datos personales innecesarios en descripciones o fotografías.</p>
  <h2>Conservación y seguridad</h2><p>Los datos deben conservarse solo durante el periodo necesario para las finalidades y obligaciones aplicables. Rescate aplica controles de acceso por rol, autenticación, registros de auditoría y medidas de protección; ningún sistema puede garantizar riesgo cero.</p>
  <h2>Derechos de las personas</h2><p>Las consultas y solicitudes relacionadas con acceso, rectificación, cancelación u oposición deben presentarse al contacto institucional que complete el responsable. Deben definirse y comunicarse los procedimientos y plazos aplicables antes del lanzamiento público.</p>
  <h2>Importante antes del lanzamiento</h2><p>Este documento es una plantilla de proyecto, no una opinión legal ni una declaración de cumplimiento normativo. No se debe habilitar el registro público hasta completar los campos marcados, confirmar el consentimiento en el servidor y obtener la revisión correspondiente.</p><p><Link href="/sign-up">Volver al registro</Link></p></div></section></main>
}
