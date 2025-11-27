import { Hono } from 'hono';
import { requireAdmin } from '../middleware/require-admin';
import { MonitoringService } from '../services/monitoring.service';
import type { AppBindings } from '../types/app';

const monitoringRouter = new Hono<AppBindings>();
const monitoringService = new MonitoringService();

// Monitoring access is controlled by requireAdmin (service token/IP/JWT)
monitoringRouter.use('*', requireAdmin);

monitoringRouter.get('/', async (c) => {
  const dashboard = await monitoringService.getDashboard();
  return c.json(dashboard);
});

export default monitoringRouter;
