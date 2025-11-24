// command/getModel.js
import calculateChecksum from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// Função auxiliar para converter a resposta HEX para Texto (ASCII)
function hexToAscii(hex) {
  let str = '';
  // Usa Buffer para decodificação (mais robusta no Node.js)
  try {
    const hexBuffer = Buffer.from(hex, 'hex');
    // Remove bytes nulos (\0) que podem ser padding no final
    str = hexBuffer.toString('ascii').replace(/\0/g, '').trim();
  } catch (e) {
    // Fallback para ambientes sem Buffer ou em caso de erro
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.substr(i, 2), 16);
      if (code !== 0) {
        str += String.fromCharCode(code);
      }
    }
  }
  return str;
}

export default (activeSockets) => async (req, res) => {
  const { centralId } = req.params;
  const targetSocket = activeSockets[centralId];

  if (!targetSocket) {
    return res.status(404).json({ status: 'Central Offline', error: `Central ID ${centralId} não está conectada.` });
  }

  // --- MONTAGEM DO PAYLOAD (Comando C2: Solicita modelo) ---
  const commandCode = 'C2';
  const lengthHex = '01';
  const commandCore = `${lengthHex}${commandCode}`;
  const checksum = calculateChecksum(commandCore);
  const commandHex = `${commandCore}${checksum}`;

  try {
    // Envia o comando e recebe a resposta (que pode ser string ou objeto)
    const rawResponse = await sendCommandOverExistingSocket(targetSocket, commandHex);
    let responseHex = '';

    // Extrai a string HEX bruta da resposta
    if (typeof rawResponse === 'object' && rawResponse !== null && rawResponse.responseHex) {
      responseHex = rawResponse.responseHex;
    } else if (typeof rawResponse === 'string') {
      responseHex = rawResponse;
    } else {
      throw new Error(`Resposta inesperada do servidor socket. Recebido: ${JSON.stringify(rawResponse)}`);
    }

    let modelName = 'Desconhecido';

    // Validação e Extração
    if (responseHex && responseHex.length > 4) {
      const responseCmd = responseHex.substring(2, 4).toUpperCase();

      // Verifica se a central respondeu C2
      if (responseCmd === commandCode) {
        // Extrai apenas os dados (do índice 4 até o final - 2, removendo Comprimento, Comando e Checksum)
        const dataHex = responseHex.substring(4, responseHex.length - 2);

        // Converte HEX (ex: 414D54...) para texto (ex: AMT...)
        modelName = hexToAscii(dataHex).trim();
      }
    }

    res.json({
      status: 'Modelo Obtido com Sucesso',
      centralId: centralId,
      command: 'get_model',
      payload_details: { sent: commandHex, received: responseHex },
      model: modelName
    });

  } catch (e) {
    res.status(500).json({
      status: 'Falha ao solicitar modelo',
      centralId: centralId,
      command: 'get_model',
      error: e.message || e,
      hex_sent: commandHex
    });
  }
};