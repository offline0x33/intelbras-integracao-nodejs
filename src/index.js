import express from 'express';
import SetupCommandRoutes from './routes.js';
import activeSockets from './utils/activeSocket.js';
import server from './serversocket.js';

const WEB_PORT = 3000;
const MONITORING_PORT = 7000;
const HOST = '0.0.0.0';

const app = express();


app.use(express.json());


server.listen(MONITORING_PORT, HOST, () => {
  console.log(`\n--- MONITORAMENTO E PROXY DE COMANDOS AMT 2018 ---`);
  console.log(`Servidor TCP escutando em ${HOST}:${MONITORING_PORT}`);
});

app.listen(WEB_PORT, () => {
  console.log(`Servidor API Express rodando em http://localhost:${WEB_PORT}`);
  console.log('-----------------------------------------\n');
});

SetupCommandRoutes(app, activeSockets);
