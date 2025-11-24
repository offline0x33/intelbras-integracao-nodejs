// command/arm.js 
import { asciiToHex } from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";
import { buildArmCommand, processArmResponse } from "../command/arm/commandhex.js";

export default (activeSockets) => async (req, res) => {
  const { centralId, user: password, partition, mode } = req.params;
  const targetSocket = activeSockets[centralId];

  // Validação de Central
  if (!targetSocket) {
    return res.status(404).json({ status: 'Central Offline', error: `Central ID ${centralId} não está conectada.` });
  }

  // Validação de Senha (Adicionada para robustez)
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Senha de 4 a 6 dígitos é obrigatória.' });
  }

  console.log('Ativar sistema - Parâmetros recebidos:', { centralId, partition, password, mode });

  // 1. Montagem do Comando
  const passwordHex = asciiToHex(password);
  const { finalHex, isecCommandBody } = buildArmCommand(partition, mode, passwordHex);

  let responseHex = '';

  try {
    // 2. Envio do Comando
    const rawResponse = await sendCommandOverExistingSocket(targetSocket, finalHex);

    // 3. Extração da string HEX bruta (Única lógica de extração que fica no endpoint)
    if (typeof rawResponse === 'object' && rawResponse !== null && rawResponse.responseHex) {
      responseHex = rawResponse.responseHex;
    } else if (typeof rawResponse === 'string') {
      responseHex = rawResponse;
    }

    // 4. Validação e Processamento (Transferido para o módulo)
    if (!responseHex || responseHex.length < 8) {
      const receivedValue = typeof rawResponse === 'object' ? JSON.stringify(rawResponse) : rawResponse;
      throw new Error(`Falha de comunicação ou resposta vazia. Recebido: ${receivedValue}`);
    }

    const { status, success } = processArmResponse(responseHex);

    res.json({
      status: status,
      success: success,
      centralId: centralId,
      command: 'arm_system',
      config_sent: {
        partition: partition || 'Full',
        mode: mode || 'Normal',
        raw_isec_body: isecCommandBody
      },
      payload_details: {
        sent: finalHex,
        received: responseHex
      }
    });

  } catch (e) {
    res.status(500).json({
      status: 'Falha ao enviar comando de ativação',
      error: e.message || e,
      hex_sent: finalHex
    });
  }
};