import express from 'express';
import { db } from './db';
import mapsRouter from './routes/maps';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use('/maps', mapsRouter);

db.migrate.latest()
  .then(() => {
    app.listen(PORT, () => console.log(`Listening on :${PORT}`));
  })
  .catch((err) => {
    console.error('Migration failed', err);
    process.exit(1);
  });
