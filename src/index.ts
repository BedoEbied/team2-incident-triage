import cors from 'cors';
import express from 'express';
import { createContainer } from './container.js';
import { errorHandler } from './http/errors.js';
import { registerRoutes } from './http/routes.js';
import { seed } from './seed.js';

const container = createContainer();
container.repo.init();
await seed(container.repo, container.parser, container.analyzer);

const app = express();
app.use(cors());
app.use(express.json());
registerRoutes(app, container);
app.use(errorHandler);

app.listen(4000, '0.0.0.0', () => {
  console.log('API listening on 0.0.0.0:4000');
});
