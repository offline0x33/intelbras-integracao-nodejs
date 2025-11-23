// command/checkGPRSModule.js
import calculateChecksum from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

export default (activeSockets) => async (req, res) => {
  const { centralId } = req.params;
  const targetSocket = activeSockets[centralId];

  if (!targetSocket) {
    return res.status(404).json({
      status: 'Central Offline',
      error: `Central ID ${centralId} não está conectada ao Servidor TCP.`
    });
  }


  // 1. Comando D3 (Verifica presença do módulo GPRS)
  const commandCode = 'D3';

  // 2. Num Bytes (Tx na imagem é 01)
  const lengthHex = '01';

  // 3. Núcleo do comando
  const commandCore = `${lengthHex}${commandCode}`;

  // 4. Calcula Checksum (Ex da imagem: 01 + D3 = Checksum 2D)
  const checksum = calculateChecksum(commandCore);

  // 5. Comando Completo
  const commandHex = `${commandCore}${checksum}`;

  try {
    const responseHex = await sendCommandOverExistingSocket(targetSocket, commandHex);

    // --- PROCESSAMENTO DA RESPOSTA (Rx) ---
    // Exemplo Imagem Rx: 02 D3 01 2F
    // 02 = Tamanho (1 byte dado + 1 byte comando)
    // D3 = Comando de retorno
    // 01 = Status (00=Ausente, 01=Presente)
    // 2F = Checksum

    let statusRaw = 'FF'; // Valor padrão de erro
    let statusText = 'Desconhecido';
    let isPresent = false;

    // Validação:
    // Header (2 chars Tam + 2 chars Cmd) = 4 chars
    // Dado (1 byte) = 2 chars
    // Checksum = 2 chars
    // Total esperado = 8 chars (Mínimo)

    if (responseHex && responseHex.length >= 8) {
      const responseCmd = responseHex.substring(2, 4);

      if (responseCmd === 'D3') {
        // Extrai o byte de status (índice 4, 2 caracteres)
        statusRaw = responseHex.substring(4, 6);

        if (statusRaw === '01') {
          statusText = 'Presente';
          isPresent = true;
        } else if (statusRaw === '00') {
          statusText = 'Ausente';
          isPresent = false;
        }
      }
    }

    res.json({
      status: 'Verificação de Módulo Concluída',
      centralId: centralId,
      command: 'check_gprs_module',
      payload_details: {
        sent: commandHex,
        received: responseHex
      },
      data: {
        raw_val: statusRaw,   // "01" ou "00"
        text: statusText,     // "Presente" ou "Ausente"
        is_present: isPresent // true ou false (útil para if/else no frontend)
      }
    });

  } catch (e) {
    res.status(500).json({
      status: 'Falha ao verificar módulo',
      centralId: centralId,
      command: 'check_gprs_module',
      error: e.message || e,
      hex_sent: commandHex
    });
  }
};