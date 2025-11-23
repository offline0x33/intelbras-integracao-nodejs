import express from "express";

import ArmHandler from "./command/arm.js";
import DisarmHandler from "./command/disarm.js";
import FirmwareHandler from "./command/firmware.js";

/**
 * Configura todos os endpoints de comando TCP (C0, 0x16, 0x17) no aplicativo Express.
 *
 * @param {express.Application} app A instância do aplicativo Express.
 * @param {Object<string, net.Socket>} activeSockets Mapa de Sockets ativos.
 */
function SetupCommandRoutes(app, activeSockets) {

  // Endpoint genérico para o comando Firmware (C0)
  const Firmware = FirmwareHandler(activeSockets);
  app.get('/api/command/firmware/:centralId', Firmware);

  // Endpoint para Armar (Comando C1)
  const Arm = ArmHandler(activeSockets);
  app.get('/api/command/arm/:centralId/:partition/:user', Arm);

  // Endpoint para Desarmar (Comando C3)
  const Disarm = DisarmHandler(activeSockets);
  app.get('/api/command/disarm/:centralId/:partition/:user', Disarm);
}

export default SetupCommandRoutes;