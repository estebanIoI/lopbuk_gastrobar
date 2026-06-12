import { Router } from 'express';
import { getStatus, triggerSync, receiveSales, receivePurchases, getChanges } from './sync.controller';
import { authenticate } from '../../common/middleware';

const router: ReturnType<typeof Router> = Router();

// Estado del sync (online/offline, pendientes) — usado por el frontend
router.get('/status', authenticate, getStatus);

// Disparar sync manual
router.post('/trigger', authenticate, triggerSync);

// Endpoint de la NUBE: sirve cambios incrementales a las instancias locales (PULL)
router.get('/changes', getChanges);

// Endpoints que usa el backend LOCAL para enviar datos a la NUBE (PUSH)
router.post('/receive-sales', receiveSales);
router.post('/receive-purchases', receivePurchases);

export { router as syncRoutes };
