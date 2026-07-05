/**
 * Plantillas legales por defecto de la plataforma (Ley 1581 de 2012 — Colombia).
 * Se muestran cuando el comercio no ha definido textos propios en
 * Personalización → Legal. Placeholders: {storeName}, {contactEmail}, {contactPhone}.
 *
 * ⚠️ Son plantillas técnicas de base: cada comercio debe validarlas con su
 * abogado antes de operar en producción.
 */

export function fillTemplate(template: string, params: { storeName?: string; contactEmail?: string; contactPhone?: string }): string {
  return template
    .replaceAll('{storeName}', params.storeName || 'este comercio')
    .replaceAll('{contactEmail}', params.contactEmail || 'el canal de contacto publicado en esta tienda')
    .replaceAll('{contactPhone}', params.contactPhone || 'el teléfono publicado en esta tienda')
}

export const DEFAULT_PRIVACY_POLICY = `POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES
(Ley 1581 de 2012 y Decreto 1377 de 2013 — República de Colombia)

1. RESPONSABLE DEL TRATAMIENTO
{storeName} es responsable del tratamiento de los datos personales que recolecta a través de esta tienda en línea. Canal de atención: {contactEmail} / {contactPhone}.

2. DATOS QUE RECOLECTAMOS
Para gestionar tus pedidos recolectamos: nombre, teléfono, correo electrónico, cédula (cuando el método de pago lo exige), dirección de entrega y, si tú lo autorizas expresamente, tu ubicación GPS para facilitar el domicilio.

3. FINALIDAD
Tus datos se usan exclusivamente para: (a) procesar y entregar tu pedido; (b) contactarte sobre el estado del mismo; (c) facturación y obligaciones fiscales; (d) enviarte ofertas por WhatsApp o correo SOLO si marcaste la casilla de autorización correspondiente.

4. TUS DERECHOS (HABEAS DATA)
Como titular de los datos tienes derecho a: conocer, actualizar y rectificar tus datos; solicitar prueba de la autorización otorgada; ser informado sobre el uso de tus datos; revocar la autorización y/o solicitar la supresión de tus datos cuando no exista un deber legal o contractual que lo impida; y acceder de forma gratuita a tus datos.

5. CÓMO EJERCER TUS DERECHOS
Puedes presentar tu solicitud desde la sección "Protección de datos" de esta tienda o escribiendo a {contactEmail}. Responderemos en un máximo de diez (10) días hábiles conforme a la Ley 1581 de 2012. Si tu solicitud no es atendida, puedes acudir a la Superintendencia de Industria y Comercio (SIC).

6. CONSERVACIÓN Y SEGURIDAD
Los datos se conservan solo el tiempo necesario para las finalidades descritas y las obligaciones legales (contables/fiscales). Aplicamos medidas técnicas de seguridad: cifrado en tránsito, control de acceso por roles y registro de auditoría de accesos a datos personales.

7. ENCARGADOS Y TERCEROS
Para operar la tienda usamos proveedores tecnológicos que actúan como encargados del tratamiento: pasarelas de pago (Wompi, MercadoPago, ADDI, Sistecrédito — los datos de tu tarjeta los procesa directamente la pasarela, nunca esta tienda), servicios de mensajería (WhatsApp) y alojamiento de imágenes. No vendemos tus datos a terceros.

8. VIGENCIA
Esta política rige desde su publicación en esta tienda. Cualquier cambio sustancial será informado en este mismo espacio.`

export const DEFAULT_TERMS = `TÉRMINOS Y CONDICIONES DE COMPRA

1. GENERAL
Al realizar un pedido en {storeName} aceptas estos términos y la Política de Tratamiento de Datos Personales.

2. PEDIDOS Y PRECIOS
Los precios publicados incluyen los impuestos aplicables salvo indicación en contrario. El pedido queda confirmado cuando el comercio lo acepta; el stock está sujeto a disponibilidad.

3. PAGOS
Los pagos en línea son procesados por pasarelas certificadas (Wompi, MercadoPago, ADDI, Sistecrédito). {storeName} no almacena datos de tarjetas.

4. ENTREGAS
Los tiempos de entrega son estimados y pueden variar por disponibilidad y zona de cobertura. Para entregas a domicilio usamos los datos de contacto y dirección que registras en el checkout.

5. CAMBIOS Y DEVOLUCIONES
Aplican las condiciones publicadas por el comercio y el Estatuto del Consumidor (Ley 1480 de 2011), incluido el derecho de retracto cuando corresponda.

6. CONTACTO
Cualquier consulta o reclamo: {contactEmail} / {contactPhone}.`

export const DEFAULT_COOKIES_POLICY = `POLÍTICA DE COOKIES Y TECNOLOGÍAS DE RASTREO

1. QUÉ USAMOS
• Esenciales (siempre activas): sesión de autenticación (cookie httpOnly) y carrito de compras (almacenamiento local). Sin ellas la tienda no funciona.
• Analítica (opcional): mediciones de uso agregadas para mejorar la tienda.
• Marketing (opcional): Meta Pixel (Facebook), que registra eventos como visitas y compras para medir campañas publicitarias del comercio.

2. TU ELECCIÓN
Las cookies de analítica y marketing están DESACTIVADAS hasta que las aceptes en el aviso de consentimiento. Puedes cambiar tu decisión en cualquier momento desde "Protección de datos" en el pie de página; el cambio aplica de inmediato.

3. TERCEROS
Si aceptas marketing, Meta (Facebook) recibe eventos de navegación conforme a su propia política de datos. No compartimos tu nombre, cédula ni dirección con redes publicitarias.

4. MÁS INFORMACIÓN
Consulta la Política de Tratamiento de Datos Personales de esta tienda o escribe a {contactEmail}.`
