import { app } from './app.js';
import { env } from './config.js';

app.listen(env.PORT, () => {
  console.info(`TRACE API listening on http://localhost:${env.PORT}`);
});
