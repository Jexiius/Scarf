import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { MonitoringService } from '../services/monitoring.service';
import type { AppBindings } from '../types/app';

const monitoringRouter = new Hono<AppBindings>();
const monitoringService = new MonitoringService();

monitoringRouter.use('*', requireAuth);

monitoringRouter.get('/', async (c) => {
  const dashboard = await monitoringService.getDashboard();
  return c.json(dashboard);
});

export default monitoringRouter;
