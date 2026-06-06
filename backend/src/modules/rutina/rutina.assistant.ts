/**
 * rutina.assistant.ts
 * Asistente IA del USUARIO final (cliente). Acceso controlado a sus propios
 * datos vía function-calling: llena su perfil, arma su rutina de ejercicio,
 * plan de comidas, lista de compras, y recomienda productos de los comercios.
 *
 * Se activa SOLO si el superadmin habilitó el asistente de plataforma
 * (platform_settings.platform_assistant_enabled) — el gate va en la ruta.
 * Reutiliza la API key central vía getAIKey() (Gemini / OpenAI / Groq).
 */
import { db } from '../../config';
import { getAIKey } from '../agent/agent.service';
import * as svc from './rutina.service';
import { RowDataPacket } from 'mysql2';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `Eres el asistente de bienestar de DAIMUZ, una plataforma que conecta a las personas con comercios (gimnasios, fruver, tiendas de proteína, ropa deportiva, etc.).
Tu trabajo es ayudar al usuario a organizar su vida saludable: conocer sus objetivos, armar su rutina de ejercicio a su medida, planear sus comidas con macros, su lista de compras, y recomendarle productos de los comercios registrados según su situación.
Reglas:
- Habla en español, cercano y motivador, pero conciso.
- Si el usuario es nuevo o le falta info, hazle un cuestionario BREVE (objetivo, peso, estatura, meta de peso, nivel de actividad) y guarda el perfil con la herramienta guardar_perfil.
- Cuando tengas sus objetivos, ofrécele armar una rutina a su medida y créala con crear_rutina_ejercicio (distribuye los días según su nivel).
- Sugiere comidas acordes a su objetivo y agrégalas con agregar_comida cuando el usuario acepte.
- Si menciona que le falta algo o quiere comprar, usa agregar_lista_compras y/o recomendar_productos.
- NO inventes productos: usa recomendar_productos para traerlos de los comercios reales.
- Ejecuta UNA acción a la vez y confirma en lenguaje natural lo que hiciste. No pidas datos que el usuario ya te dio.`;

// ─────────────────────────────────────────────────────────────
// Declaraciones de herramientas (Gemini functionDeclarations)
// ─────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'guardar_perfil',
    description: 'Guarda o actualiza el perfil del usuario (objetivos y datos físicos).',
    parameters: {
      type: 'OBJECT',
      properties: {
        goal: { type: 'STRING', description: 'bajar_peso | subir_masa | mantener | salud_general' },
        weightKg: { type: 'NUMBER' },
        heightCm: { type: 'NUMBER' },
        targetWeightKg: { type: 'NUMBER' },
        dailyCalorieTarget: { type: 'INTEGER' },
        activityLevel: { type: 'STRING', description: 'sedentario | ligero | moderado | activo | muy_activo' },
        waterTargetMl: { type: 'INTEGER' },
      },
    },
  },
  {
    name: 'crear_rutina_ejercicio',
    description: 'Crea una rutina de ejercicio con actividades por día de la semana.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Nombre de la rutina, ej: "Hipertrofia 4 días"' },
        actividades: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              dayOfWeek: { type: 'INTEGER', description: '0=Dom..6=Sáb. Omitir para diario.' },
              title: { type: 'STRING', description: 'ej: "Pecho y tríceps", "Cardio 30min"' },
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
      type: 'OBJECT',
      properties: {
        mealType: { type: 'STRING', description: 'desayuno | media_manana | almuerzo | onces | cena | snack' },
        title: { type: 'STRING' },
        calories: { type: 'INTEGER' },
        proteinG: { type: 'NUMBER' },
        carbsG: { type: 'NUMBER' },
        fatG: { type: 'NUMBER' },
      },
      required: ['mealType', 'title'],
    },
  },
  {
    name: 'agregar_lista_compras',
    description: 'Agrega uno o varios ítems a la lista de compras del usuario.',
    parameters: {
      type: 'OBJECT',
      properties: {
        items: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              quantity: { type: 'NUMBER' },
              unit: { type: 'STRING' },
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
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'qué buscar, ej: "proteína whey", "frutas", "tenis"' } },
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
): Promise<{ reply: string; products?: any[]; action?: string }> {
  const apiKey = await getAIKey();
  if (!apiKey) return { reply: 'El asistente no está configurado todavía. Intenta más tarde.' };

  // Solo Gemini soporta el function-calling de este asistente
  if (!apiKey.startsWith('AIza')) {
    return { reply: 'El asistente requiere una clave de IA compatible (Gemini). Avísale al administrador.' };
  }

  const contents = [...history, { role: 'user', content: message }]
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    tools: [{ functionDeclarations: TOOLS }],
    tool_config: { function_calling_config: { mode: 'AUTO' } },
    generationConfig: { maxOutputTokens: 700, temperature: 0.7 },
  };

  const r1 = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r1.ok) {
    if (r1.status === 429) return { reply: 'Estoy recibiendo muchas consultas, intenta en unos segundos. 🙏' };
    throw new Error(`Gemini error: ${await r1.text()}`);
  }
  const d1 = await r1.json() as any;
  const cand = d1.candidates?.[0]?.content;
  const fcPart = cand?.parts?.find((p: any) => p.functionCall);

  if (!fcPart) {
    return { reply: cand?.parts?.find((p: any) => p.text)?.text || 'No pude procesar tu mensaje.' };
  }

  // Ejecutar la herramienta
  const { name, args } = fcPart.functionCall;
  const exec = await executeTool(name, args || {}, userId);

  // Segunda llamada para respuesta natural a partir del resultado
  const r2 = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        ...contents,
        { role: 'model', parts: [{ functionCall: { name, args } }] },
        { role: 'user', parts: [{ functionResponse: { name, response: { content: exec.summary } } }] },
      ],
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
    }),
  });
  let reply = exec.summary;
  if (r2.ok) {
    const d2 = await r2.json() as any;
    reply = d2.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || exec.summary;
  }
  return { reply, products: exec.products, action: exec.action };
}

/** ¿Está habilitado el asistente de plataforma? */
export async function isPlatformAssistantEnabled(): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT setting_value FROM platform_settings WHERE setting_key = 'platform_assistant_enabled' LIMIT 1"
  );
  const v = (rows as any[])?.[0]?.setting_value;
  return v === '1' || v === 'true';
}
