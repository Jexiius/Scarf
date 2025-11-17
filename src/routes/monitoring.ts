import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/require-admin';
import { MonitoringService } from '../services/monitoring.service';
import type { AppBindings } from '../types/app';

const monitoringRouter = new Hono<AppBindings>();
const monitoringService = new MonitoringService();

// Require authentication first, then admin access
monitoringRouter.use('*', requireAuth);
monitoringRouter.use('*', requireAdmin);

monitoringRouter.get('/', async (c) => {
  const dashboard = await monitoringService.getDashboard();
  return c.json(dashboard);
});

export default monitoringRouter;
