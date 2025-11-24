// command/getMac.js (CÓDIGO CORRIGIDO)
import calculateChecksum from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// Função auxiliar para formatar o MAC Address (XX:XX:XX:XX:XX:XX)
function formatMacAddress(hexParams) {
  // Pega a string hex pura e divide em pares de 2 caracteres
  // Garante que a entrada seja tratada como string e que tenha 12 caracteres (6 bytes)
  if (typeof hexParams !== 'string' || hexParams.length !== 12) {
    return "Formato inválido";
  }

  // Divide em pares de 2 caracteres e junta com ':'
  return hexParams.match(/.{1,2}/g).join(':').toUpperCase();
}

export default (activeSockets) => async (req, res) => {
  const { centralId } = req.params;
  const targetSocket = activeSockets[centralId];

  // ... (Validação de Central Offline) ...

  // 1. Comando C4 (Solicita MAC)
  const commandCode = 'C4';
  const lengthHex = '01';
  const commandCore = `${lengthHex}${commandCode}`;
  const checksum = calculateChecksum(commandCore);
  const commandHex = `${commandCore}${checksum}`;

  try {
    const rawResponse = await sendCommandOverExistingSocket(targetSocket, commandHex);
    let responseHex = '';

    // Lógica para lidar com strings ou objetos de resposta (como em arm.js e disarm.js)
    if (typeof rawResponse === 'object' && rawResponse !== null && rawResponse.responseHex) {
      responseHex = rawResponse.responseHex;
    } else if (typeof rawResponse === 'string') {
      responseHex = rawResponse;
    } else {
      throw new Error(`Resposta inválida ou vazia. Recebido: ${JSON.stringify(rawResponse)}`);
    }

    // 2. Validação da Resposta
    if (responseHex.length < 14) { // Tamanho mínimo esperado (7 bytes de dados + 2 bytes de cabeçalho + 1 byte de checksum = 10 bytes, 20 chars)
      // O MAC Address são 6 bytes (12 chars). A resposta completa tem 7 bytes + comando + checksum. Mínimo 14 chars.
      throw new Error(`Resposta muito curta. Esperado pelo menos 14 chars, recebido ${responseHex.length}.`);
    }

    const responseCmd = responseHex.substring(2, 4).toUpperCase();

    if (responseCmd !== commandCode) {
      throw new Error(`Comando de resposta inesperado: ${responseCmd}. Esperado ${commandCode}.`);
    }

    // 🛑 3. EXTRAÇÃO DO MAC ADDRESS (6 bytes, 12 caracteres) 🛑
    // O MAC começa após o Comprimento (0-2) e o Comando (2-4).
    // O MAC termina antes do Checksum (últimos 2 caracteres).
    const macDataHex = responseHex.substring(4, responseHex.length - 2);

    // O MAC address são os primeiros 12 caracteres dos dados (6 bytes)
    const macRaw = macDataHex.substring(0, 12).toUpperCase();

    // 4. Formatação e Retorno
    const macFormatted = formatMacAddress(macRaw);

    res.json({
      status: "MAC Address Obtido",
      centralId: centralId,
      command: 'get_mac',
      payload_details: {
        sent: commandHex,
        received: responseHex
      },
      data: {
        mac_raw: macRaw,
        mac_formatted: macFormatted
      }
    });

  } catch (e) {
    res.status(500).json({
      status: 'Falha ao solicitar MAC',
      centralId: centralId,
      command: 'get_mac',
      error: e.message || e,
      hex_sent: commandHex
    });
  }
};