// command/checkGPRSModule.js
import sendCommandOverExistingSocket from "../utils/protocol.js";
// Importa a constante e as funções do serviço
import {
  buildSimpleQueryCommand,
  processModuleQueryResponse,
  CHECK_GPRS_COMMAND // Constante D3
} from "../command/gprs/commandhexgprs.js";

export default (activeSockets) => async (req, res) => {
  const { centralId } = req.params;
  const targetSocket = activeSockets[centralId];
  let finalHex = '';
  let responseHex = '';

  // 1. Validação da Central
  if (!targetSocket) {
    return res.status(404).json({
      status: 'Central Offline',
      error: `Central ID ${centralId} não está conectada ao Servidor TCP.`
    });
  }

  try {
    // 2. Montagem do Comando, usando a constante importada
    finalHex = buildSimpleQueryCommand(CHECK_GPRS_COMMAND);

    // 3. Envio e Extração da Resposta
    const rawResponse = await sendCommandOverExistingSocket(targetSocket, finalHex);

    if (typeof rawResponse === 'object' && rawResponse !== null && rawResponse.responseHex) {
      responseHex = rawResponse.responseHex;
    } else if (typeof rawResponse === 'string') {
      responseHex = rawResponse;
    }

    // 4. Validação de Comunicação Mínima
    if (!responseHex || responseHex.length < 8) {
      throw new Error(`Falha de comunicação ou resposta vazia. Recebido: ${responseHex}`);
    }

    // 5. Processamento, usando a constante importada
    const decodedData = processModuleQueryResponse(responseHex, CHECK_GPRS_COMMAND);

    // 6. Resposta Final
    res.json({
      status: decodedData.status,
      centralId: centralId,
      command: 'check_gprs_module',
      payload_details: {
        sent: finalHex,
        received: responseHex
      },
      data: {
        raw_val: decodedData.raw_val,
        text: decodedData.text,
        is_present: decodedData.is_present
      }
    });

  } catch (e) {
    // 7. Tratamento de Erro
    res.status(500).json({
      status: 'Falha ao verificar módulo',
      centralId: centralId,
      command: 'check_gprs_module',
      error: e.message || e,
      hex_sent: finalHex
    });
  }
};