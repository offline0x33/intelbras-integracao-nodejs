// command/disarm.js
import { asciiToHex } from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";
import { buildDisarmCommand, processArmResponse } from "../command/armdisarm/commandhex.js";

export default (activeSockets) => async (req, res) => {
  // Lê os parâmetros da rota GET
  const { centralId, partition, user: password } = req.params;
  const targetSocket = activeSockets[centralId];

  // Validação de Central
  if (!targetSocket) {
    return res.status(404).json({
      status: 'Central Offline',
      error: `Central ID ${centralId} não está conectada ao Servidor TCP.`
    });
  }

  // Validação de Senha
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Senha de 4 a 6 dígitos é obrigatória.' });
  }

  console.log('Desarmar sistema - Parâmetros recebidos:', { centralId, partition, password });

  // 1. Montagem do Comando (Chama a nova função)
  const passwordHex = asciiToHex(password);
  const { finalHex, isecCommandBody } = buildDisarmCommand(partition, passwordHex);

  let responseHex = '';

  try {
    // 2. Envio do Comando
    const rawResponse = await sendCommandOverExistingSocket(targetSocket, finalHex);

    // 3. Extração da string HEX bruta
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

    // 5. Chama o processador, indicando que é um comando de Desarmar
    const { status, success } = processArmResponse(responseHex, true);

    res.json({
      status: status,
      success: success,
      centralId: centralId,
      command: 'disarm_system',
      config_sent: {
        partition: partition || 'Full',
        raw_isec_body: isecCommandBody // Nome ajustado para consistência
      },
      payload_details: {
        sent: finalHex,
        received: responseHex
      }
    });

  } catch (e) {
    res.status(500).json({
      status: 'Falha ao enviar comando de desativação',
      error: e.message || e,
      hex_sent: finalHex
    });
  }
};