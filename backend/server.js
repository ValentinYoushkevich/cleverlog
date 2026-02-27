import app from './app.js';
import db from './src/config/knex.js';
import logger from './src/config/logger.js';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await db.raw('SELECT 1');
    logger.info('PostgreSQL connected');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to connect to DB', { error: err.message });
    process.exit(1);
  }
}

start();
