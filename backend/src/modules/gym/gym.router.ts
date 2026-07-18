/**
 * gym.router.ts
 * Router maestro del módulo Gimnasio.
 * Monta los sub-routers de cada dominio.
 * Las rutas legacy de gym.routes.ts se montan en la raíz.
 * Las nuevas rutas del dominio members se montan bajo /gym también.
 */
import { Router } from 'express';
import gymLegacyRoutes from './gym.routes';
import { membersRoutes } from './members';

const router = Router();

// Rutas legacy (membresías, planes, progreso, asistencia, check-in, QR)
router.use(gymLegacyRoutes);

// Dominio Personas (miembros, perfiles, objetivos, timeline)
router.use(membersRoutes);

export default router;
