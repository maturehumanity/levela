import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './models/db';

// Import routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import endorsementsRoutes from './routes/endorsements';
import evidenceRoutes from './routes/evidence';
import feedRoutes from './routes/feed';
import reportsRoutes from './routes/reports';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initializeDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/endorsements', endorsementsRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/reports', reportsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Levela API server running on http://localhost:${PORT}`);
});
