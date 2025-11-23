// command/getMac.js
import calculateChecksum from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// Função auxiliar para formatar o MAC Address (XX:XX:XX:XX:XX:XX)
function formatMacAddress(hexParams) {
  // Pega a string hex pura e divide em pares de 2 caracteres
  if (!hexParams || hexParams.length !== 12) return hexParams;

  return hexParams.match(/.{1,2}/g).join(':').toUpperCase();
}

export default (activeSockets) => async (req, res) => {
  const { centralId } = req.params;
  const targetSocket = activeSockets[centralId];

  if (!targetSocket) {
    return res.status(404).json({
      status: 'Central Offline',
      error: `Central ID ${centralId} não está conectada ao Servidor TCP.`
    });
  }

  // 1. Comando C4 (Solicita MAC)
  const commandCode = 'C4';

  // 2. Num Bytes (Tx na imagem é 01)
  // O frame contém apenas o byte do comando.
  const lengthHex = '01';

  // 3. Núcleo do comando
  const commandCore = `${lengthHex}${commandCode}`;

  // 4. Calcula Checksum (Ex da imagem: 01 + C4 = 3A na lógica da central)
  const checksum = calculateChecksum(commandCore);

  // 5. Comando Completo
  const commandHex = `${commandCore}${checksum}`;

  try {
    const responseHex = await sendCommandOverExistingSocket(targetSocket, commandHex);

    // --- PROCESSAMENTO DA RESPOSTA (Rx) ---
    // Exemplo Imagem Rx: 07 C4 00 1A 3F 30 00 00 29
    // 07 = Tamanho (7 bytes de dados + comando)
    // C4 = Comando de retorno
    // 001A3F300000 = Dados (O MAC Address em si, 6 bytes = 12 chars)
    // 29 = Checksum

    let macAddressFormatted = 'Não identificado';
    let macRaw = '';

    // Validação básica: Tamanho mínimo esperado (Header 4 chars + MAC 12 chars + Checksum 2 chars = 18 chars)
    if (responseHex && responseHex.length >= 18) {

      const responseCmd = responseHex.substring(2, 4);

      if (responseCmd === 'C4') {
        // Extrai os 6 bytes do MAC (12 caracteres hexadecimais)
        // Começa no índice 4 (pula Tam e Cmd)
        // Pega 12 caracteres
        macRaw = responseHex.substring(4, 16);

        macAddressFormatted = formatMacAddress(macRaw);
      }
    }

    res.json({
      status: 'MAC Address Obtido',
      centralId: centralId,
      command: 'get_mac',
      payload_details: {
        sent: commandHex,
        received: responseHex
      },
      data: {
        mac_raw: macRaw,
        mac_formatted: macAddressFormatted // Retorna ex: "00:1A:3F:30:00:00"
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