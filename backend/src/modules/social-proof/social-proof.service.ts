import { db } from '../../config';
import { RowDataPacket } from 'mysql2';
import { getProductViewers } from './social-proof.socket';

/**
 * Social Proof Engine (Fase 5) — SOLO DATOS REALES.
 *
 * Cada señal se deriva de datos verdaderos del sistema; nada se simula:
 *  · viewers      → espectadores concurrentes reales (presencia por Socket.io)
 *  · soldRecent   → unidades vendidas en los últimos N días (sale_items + ventas completadas)
 *  · soldTotal    → unidades vendidas históricas
 *  · lastPurchase → fecha de la última venta real
 *  · stock        → stock disponible real (producto − reservado)
 *  · rating/reviews → reseñas APROBADAS (verificadas)
 *
 * Si una señal no tiene respaldo real, se devuelve nula y el frontend NO la
 * muestra. No hay contadores inventados ni "N personas comprando" ficticio.
 */

const RECENT_DAYS = 7;

export interface SocialProof {
  productId: string;
  viewers: number;            // espectadores en vivo (0 = no se muestra)
  soldRecent: number;         // unidades vendidas en RECENT_DAYS
  soldTotal: number;
  recentDays: number;
  lastPurchaseAt: string | null;
  stock: number | null;
  lowStock: boolean;          // stock real bajo (≤ umbral) y > 0
  reviewCount: number;        // reseñas aprobadas
  avgRating: number | null;   // promedio de reseñas aprobadas
}

const LOW_STOCK_THRESHOLD = 10;

export class SocialProofService {
  async getForProduct(productId: string): Promise<SocialProof> {
    // Ventas reales (solo ventas completadas)
    const [sold] = await db.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN s.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN si.quantity ELSE 0 END), 0) AS recent,
         COALESCE(SUM(si.quantity), 0) AS total,
         MAX(s.created_at) AS lastPurchase
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id AND s.status = 'completada'
       WHERE si.product_id = ?`,
      [RECENT_DAYS, productId]
    );

    // Stock real disponible
    const [prod] = await db.execute<RowDataPacket[]>(
      'SELECT stock, reserved_stock FROM products WHERE id = ? LIMIT 1',
      [productId]
    );
    const stock = prod.length
      ? Math.max(0, Number(prod[0].stock || 0) - Number(prod[0].reserved_stock || 0))
      : null;

    // Reseñas aprobadas (verificadas)
    const [rev] = await db.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS n, AVG(rating) AS avg FROM product_reviews WHERE product_id = ? AND status = 'aprobado'",
      [productId]
    );

    const soldRecent = Number(sold[0]?.recent || 0);
    const soldTotal = Number(sold[0]?.total || 0);
    const reviewCount = Number(rev[0]?.n || 0);

    return {
      productId,
      viewers: getProductViewers(productId),
      soldRecent,
      soldTotal,
      recentDays: RECENT_DAYS,
      lastPurchaseAt: sold[0]?.lastPurchase || null,
      stock,
      lowStock: stock != null && stock > 0 && stock <= LOW_STOCK_THRESHOLD,
      reviewCount,
      avgRating: reviewCount > 0 && rev[0]?.avg != null ? Math.round(Number(rev[0].avg) * 10) / 10 : null,
    };
  }
}

export const socialProofService = new SocialProofService();
