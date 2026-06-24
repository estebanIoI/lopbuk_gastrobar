/**
 * rutina.assistant.ts
 * Asistente IA del USUARIO final (cliente). Acceso controlado a sus propios
 * datos vía function-calling: llena su perfil, arma su rutina de ejercicio,
 * plan de comidas, lista de compras, y recomienda productos de los comercios.
 *
 * Se activa SOLO si el superadmin habilitó el asistente de plataforma
 * (platform_settings.platform_assistant_enabled) — el gate va en la ruta.
 * Corre sobre el orchestrator (agentLoop): function-calling provider-agnóstico,
 * funciona con OpenCode Go / OpenAI / Groq / Gemini según lo configurado.
 */
import { db } from '../../config';
import { agentLoop, ToolDef } from '../ai/orchestrator.service';
import * as svc from './rutina.service';
import { COACH_KB } from './rutina.coach-kb';
import { RowDataPacket } from 'mysql2';

// El conocimiento de coach (COACH_KB) va PRIMERO como bloque estable: define cómo
// razona el coach (objetivos, programación, nutrición, progresión, seguridad). Debajo
// va la capa específica de DAIMUZ (herramientas, productos de comercios, integración).
const SYSTEM_PROMPT = `${COACH_KB}

# CONTEXTO DAIMUZ (cómo operas dentro de la app)
Eres el Coach de bienestar de DAIMUZ, una plataforma que conecta a las personas con comercios (gimnasios, fruver, tiendas de proteína, ropa deportiva, etc.). Aplicas TODO el conocimiento base de arriba para dar recomendaciones precisas y seguras, y además operas la app del usuario con tus herramientas.
Reglas de operación:
- Habla en español, cercano y motivador, pero conciso. Aplica el conocimiento base: detecta el objetivo y ajusta series/reps/descanso/frecuencia y nutrición según corresponda.
- Si el usuario es nuevo o falta info crítica, haz un cuestionario BREVE (objetivo, peso, estatura, meta de peso, nivel de actividad, días disponibles, lesiones) y guarda el perfil con guardar_perfil. No pidas lo que ya te dieron.
- Cuando tengas el objetivo, ofrece armar la rutina y créala con crear_rutina_ejercicio, distribuyendo los días según objetivo y nivel (ej.: hipertrofia 4–6 días PPL/Torso-Pierna; fuerza 3–5 días Upper/Lower; salud 2–3 días full body). En cada día pon un título claro y, cuando aplique, el esquema (ej.: "Pierna — 4x8-12", "Cardio 30 min Z2").
- Sugiere comidas acordes al objetivo (calorías según meta, proteína 1.6–2.2 g/kg) y agrégalas con agregar_comida cuando el usuario acepte. Da macros realistas.
- Si le falta algo o quiere comprar, usa agregar_lista_compras y/o recomendar_productos. NO inventes productos: tráelos de comercios reales con recomendar_productos.
- Ejecuta UNA acción a la vez y confirma en lenguaje natural lo que hiciste.
- SEGURIDAD: ante dolor severo/persistente, mareo, dolor de pecho, lesión o señales de trastorno alimentario, recomienda atención profesional y no continúes con un plan que pueda dañar. Nunca recomiendes esteroides, dietas extremas ni sobreentrenamiento.`;

// ─────────────────────────────────────────────────────────────
// Declaraciones de herramientas (Gemini functionDeclarations)
// ─────────────────────────────────────────────────────────────
// Tools en JSON-schema estándar (tipos en minúscula). El orchestrator las traduce
// al formato de cada proveedor (OpenAI `tools` o Gemini `functionDeclarations`).
const TOOLS: ToolDef[] = [
  {
    name: 'guardar_perfil',
    description: 'Guarda o actualiza el perfil del usuario (objetivos y datos físicos).',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Guarda el objetivo en uno de estos 4 valores. Mapea la meta detectada: pérdida de grasa→bajar_peso; hipertrofia/fuerza/recomposición/rendimiento→subir_masa; movilidad→salud_general; salud/mantenimiento→mantener. Valores válidos: bajar_peso | subir_masa | mantener | salud_general' },
        weightKg: { type: 'number' },
        heightCm: { type: 'number' },
        targetWeightKg: { type: 'number' },
        dailyCalorieTarget: { type: 'integer' },
        activityLevel: { type: 'string', description: 'sedentario | ligero | moderado | activo | muy_activo' },
        waterTargetMl: { type: 'integer' },
      },
    },
  },
  {
    name: 'crear_rutina_ejercicio',
    description: 'Crea una rutina de ejercicio con actividades por día de la semana.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la rutina, ej: "Hipertrofia 4 días"' },
        actividades: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dayOfWeek: { type: 'integer', description: '0=Dom..6=Sáb. Omitir para diario.' },
              title: { type: 'string', description: 'ej: "Pecho y tríceps — 4x8-12", "Cardio 30min Z2"' },
            },
            required: ['title'],
          },
        },
      },
      required: ['name', 'actividades'],
    },
  },
  {
    name: 'agregar_comida',
    description: 'Agrega una comida al plan de hoy con sus macros.',
    parameters: {
      type: 'object',
      properties: {
        mealType: { type: 'string', description: 'desayuno | media_manana | almuerzo | onces | cena | snack' },
        title: { type: 'string' },
        calories: { type: 'integer' },
        proteinG: { type: 'number' },
        carbsG: { type: 'number' },
        fatG: { type: 'number' },
      },
      required: ['mealType', 'title'],
    },
  },
  {
    name: 'agregar_lista_compras',
    description: 'Agrega uno o varios ítems a la lista de compras del usuario.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number' },
              unit: { type: 'string' },
            },
            required: ['name'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'recomendar_productos',
    description: 'Busca productos reales en los comercios registrados para recomendarlos (proteína, fruta, ropa deportiva, etc.).',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'qué buscar, ej: "proteína whey", "frutas", "tenis"' } },
      required: ['query'],
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Búsqueda de productos cross-comercio (controlada)
// ─────────────────────────────────────────────────────────────
async function searchProductsCrossTenant(query: string) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT p.id, p.name, p.sale_price AS salePrice, p.image_url AS imageUrl, p.category,
            t.name AS tenantName, t.slug AS tenantSlug
     FROM products p JOIN tenants t ON t.id = p.tenant_id
     WHERE t.status = 'activo' AND p.published_in_store = 1 AND p.stock > 0
       AND (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ? OR p.brand LIKE ?)
     ORDER BY p.stock DESC
     LIMIT 6`,
    [like, like, like, like]
  );
  return (rows as any[]).map(r => ({
    id: String(r.id), name: r.name, salePrice: Number(r.salePrice),
    imageUrl: r.imageUrl || null, category: r.category || null,
    tenantName: r.tenantName, tenantSlug: r.tenantSlug,
  }));
}

// ─────────────────────────────────────────────────────────────
// Ejecución de herramientas (scoped al userId)
// ─────────────────────────────────────────────────────────────
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

async function executeTool(name: string, args: any, userId: string): Promise<{ summary: string; products?: any[]; action?: string }> {
  switch (name) {
    case 'guardar_perfil': {
      await svc.upsertPerfil(userId, args);
      return { summary: 'Perfil guardado correctamente.', action: 'perfil' };
    }
    case 'crear_rutina_ejercicio': {
      const { id } = await svc.createRutina(userId, { name: args.name, type: 'ejercicio' });
      const acts = Array.isArray(args.actividades) ? args.actividades : [];
      for (const a of acts) {
        await svc.addActividad(userId, id, {
          title: a.title,
          dayOfWeek: (a.dayOfWeek === undefined || a.dayOfWeek === null) ? null : Number(a.dayOfWeek),
          type: 'ejercicio',
        });
      }
      const dias = acts.map((a: any) => a.dayOfWeek != null ? `${DAYS[a.dayOfWeek]}: ${a.title}` : a.title).join('; ');
      return { summary: `Rutina "${args.name}" creada con ${acts.length} días (${dias}).`, action: 'rutina' };
    }
    case 'agregar_comida': {
      const today = new Date().toISOString().slice(0, 10);
      await svc.addPlanComida(userId, { ...args, planDate: today });
      return { summary: `Comida "${args.title}" agregada al plan de hoy.`, action: 'comida' };
    }
    case 'agregar_lista_compras': {
      const items = Array.isArray(args.items) ? args.items : [];
      for (const it of items) await svc.addCompra(userId, it);
      return { summary: `${items.length} ítem(s) agregados a tu lista de compras.`, action: 'compras' };
    }
    case 'recomendar_productos': {
      const products = await searchProductsCrossTenant(args.query);
      const summary = products.length
        ? `Encontré ${products.length} productos: ${products.map(p => `${p.name} (${p.tenantName})`).join(', ')}.`
        : 'No encontré productos para esa búsqueda en los comercios.';
      return { summary, products, action: 'productos' };
    }
    default:
      return { summary: 'Acción no reconocida.' };
  }
}

// ─────────────────────────────────────────────────────────────
// Loop principal del asistente (Gemini con tools)
// ─────────────────────────────────────────────────────────────
export async function runAssistant(
  userId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  advanced = false,   // C7.3: LEGEND (entitlement routine_ai) → modo coach avanzado
): Promise<{ reply: string; products?: any[]; action?: string }> {
  // Free = IA básica; LEGEND = AI Coach (planes completos, nutrición contextual, combos, más memoria).
  const systemPrompt = advanced
    ? `${SYSTEM_PROMPT}\n\n[MODO AI COACH LEGEND] El usuario es miembro LEGEND. Entrega planes completos y detallados, contexto nutricional profundo, recomendaciones inteligentes y combos de productos sugeridos para su objetivo. Sé proactivo, específico y motivador.`
    : SYSTEM_PROMPT;

  // El orchestrator maneja el proveedor (OpenCode Go / OpenAI / Groq / Gemini),
  // el function-calling, el respaldo y la telemetría. Capturamos products/action
  // del último tool ejecutado vía closure para devolverlos al frontend.
  let lastProducts: any[] | undefined;
  let lastAction: string | undefined;

  try {
    const result = await agentLoop({
      system: systemPrompt,
      messages: [...history, { role: 'user', content: message }],
      tools: TOOLS,
      execute: async (name, args) => {
        const exec = await executeTool(name, args || {}, userId);
        if (exec.products) lastProducts = exec.products;
        if (exec.action) lastAction = exec.action;
        return exec.summary;
      },
      maxTokens: advanced ? 1100 : 600,
      temperature: 0.7,
      tier: advanced ? 'main' : 'small',
      maxRounds: 6,
    });
    return { reply: result.reply || 'No pude procesar tu mensaje.', products: lastProducts, action: lastAction };
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'NO_AI_KEY') return { reply: 'El asistente no está configurado todavía. Avísale al administrador.' };
    if (msg.includes('429')) return { reply: 'Estoy recibiendo muchas consultas, intenta en unos segundos. 🙏' };
    return { reply: 'No pude responder en este momento, intenta de nuevo.' };
  }
}

/** ¿Está habilitado el asistente de plataforma? */
export async function isPlatformAssistantEnabled(): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT setting_value FROM platform_settings WHERE setting_key = 'platform_assistant_enabled' LIMIT 1"
  );
  const v = (rows as any[])?.[0]?.setting_value;
  return v === '1' || v === 'true';
}
