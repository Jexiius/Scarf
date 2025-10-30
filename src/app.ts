import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { auth } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limit';
import { requestLogger } from './middleware/request-logger';
import authRouter from './routes/auth';
import monitoringRouter from './routes/monitoring';
import restaurantRouter from './routes/restaurants';
import searchRouter from './routes/search';
import userRouter from './routes/users';
import type { AppBindings } from './types/app';

const app = new Hono<AppBindings>();

app.use('*', requestLogger);
app.use('*', cors());
app.use('*', prettyJSON());
app.use('/api/*', auth);
app.use('/api/*', rateLimiter());

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/v1/search', searchRouter);
app.route('/api/v1/auth', authRouter);
app.route('/api/v1/restaurants', restaurantRouter);
app.route('/api/v1/users', userRouter);
app.route('/api/v1/monitoring', monitoringRouter);

app.onError(errorHandler);

export default app;
