import express from "express";

// --- Comandos de Ação/Controle ---
import ArmHandler from "./resources/arm.js";
import DisarmHandler from "./resources/disarm.js";
import FirmwareHandler from "./command/firmware.js";

// --- Comandos de Informação (Novos que criamos) ---
import GetModelHandler from "./command/model.js";           // C2
import GetMacHandler from "./command/mac.js";               // C4
import GetIMEIHandler from "./command/imei.js";             // C5
import GetICCIDHandler from "./command/iccid.js";           // C6
import GetSignalHandler from "./command/signalstrength.js"; // D1
import CheckGPRSHandler from "./resources/checkgprsmodule.js";   // D3

/**
 * Configura todos os endpoints de comando TCP no aplicativo Express.
 *
 * @param {express.Application} app A instância do aplicativo Express.
 * @param {Object<string, net.Socket>} activeSockets Mapa de Sockets ativos.
 */
function SetupCommandRoutes(app, activeSockets) {

  // ==================================================================
  // 1. COMANDOS DE AÇÃO (Controle da Central)
  // ==================================================================

  // Endpoint para Armar (Comando ISECNet E9)
  // Rota: /api/command/arm/0001/1/1234/stay (Opcional: mode)
  // Adaptei para aceitar o parametro 'mode' (stay ou full) no final
  const Arm = ArmHandler(activeSockets);
  app.get('/api/command/arm/:centralId/:partition/:user/:mode?', Arm);

  // Endpoint para Desarmar (Comando ISECNet E9 - Desativação)
  const Disarm = DisarmHandler(activeSockets);
  app.get('/api/command/disarm/:centralId/:partition/:user', Disarm);

  // ==================================================================
  // 2. COMANDOS DE DIAGNÓSTICO E INFORMAÇÃO
  // ==================================================================

  // Solicita Modelo (C2) -> Retorna "AMT 8000", etc.
  const GetModel = GetModelHandler(activeSockets);
  app.get('/api/command/info/model/:centralId', GetModel);

  // Solicita MAC Address (C4) -> Retorna "00:1A:..."
  const GetMac = GetMacHandler(activeSockets);
  app.get('/api/command/info/mac/:centralId', GetMac);

  // Solicita IMEI (C5) -> Retorna o IMEI do módulo GPRS
  const GetIMEI = GetIMEIHandler(activeSockets);
  app.get('/api/command/info/imei/:centralId', GetIMEI);

  // Solicita ICCID (C6) -> Retorna o ID do Chip (Sim Card)
  const GetICCID = GetICCIDHandler(activeSockets);
  app.get('/api/command/info/iccid/:centralId', GetICCID);

  // Solicita Nível de Sinal (D1) -> Retorna valor e qualidade (Bom/Ruim)
  const GetSignal = GetSignalHandler(activeSockets);
  app.get('/api/command/info/signal/:centralId', GetSignal);

  // Verifica Módulo GPRS (D3) -> Retorna Presente/Ausente
  const CheckGPRS = CheckGPRSHandler(activeSockets);
  app.get('/api/command/info/gprs_status/:centralId', CheckGPRS);

  // Endpoint genérico legado para Firmware (C0)
  const Firmware = FirmwareHandler(activeSockets);
  app.get('/api/command/firmware/:centralId', Firmware);
}

export default SetupCommandRoutes;