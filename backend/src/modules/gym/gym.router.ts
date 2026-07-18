/**
 * gym.router.ts
 * Router maestro del módulo Gimnasio.
 * Monta los sub-routers de cada dominio.
 */
import { Router } from 'express';
import gymLegacyRoutes from './gym.routes';
import { membersRoutes } from './members';
import { trainingRoutes } from './training';
import { healthRoutes } from './health';

const router = Router();

router.use(gymLegacyRoutes);
router.use(membersRoutes);
router.use(trainingRoutes);
router.use(healthRoutes);

export default router;
