// command/getSignalStrength.js
import calculateChecksum from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// Função auxiliar para interpretar a qualidade do sinal (Escala CSQ comum)
function getSignalQualityLabel(level) {
  if (level === 99) return 'Desconhecido/Erro';
  if (level >= 20) return 'Excelente';
  if (level >= 15) return 'Bom';
  if (level >= 10) return 'Regular';
  if (level > 0) return 'Fraco';
  return 'Sem Sinal';
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

  // 1. Comando D1 (Solicita Nível de Sinal)
  const commandCode = 'D1';

  // 2. Num Bytes (Tx na imagem é 01)
  const lengthHex = '01';

  // 3. Núcleo do comando
  const commandCore = `${lengthHex}${commandCode}`;

  // 4. Calcula Checksum (Ex da imagem: 01 + D1 = Checksum 2F)
  const checksum = calculateChecksum(commandCore);

  // 5. Comando Completo
  const commandHex = `${commandCore}${checksum}`;

  try {
    const responseHex = await sendCommandOverExistingSocket(targetSocket, commandHex);

    // --- PROCESSAMENTO DA RESPOSTA (Rx) ---
    // Exemplo Imagem Rx: 02 D1 10 3C
    // 02 = Tamanho (1 byte de comando + 1 byte de dado = 2 bytes)
    // D1 = Comando de retorno
    // 10 = Dado (Valor Hexadecimal do sinal). 0x10 = 16 decimal.
    // 3C = Checksum

    let signalValue = 0;
    let signalLabel = 'N/A';

    // Validação:
    // Header (2 chars Tam + 2 chars Cmd) = 4 chars
    // Dado (1 byte) = 2 chars
    // Checksum = 2 chars
    // Total esperado = 8 chars

    if (responseHex && responseHex.length >= 8) {
      const responseCmd = responseHex.substring(2, 4);

      if (responseCmd === 'D1') {
        // Extrai o byte de sinal (índice 4, 2 caracteres)
        const dataHex = responseHex.substring(4, 6);

        // Converte Hex para Inteiro (Ex: "10" -> 16)
        signalValue = parseInt(dataHex, 16);

        signalLabel = getSignalQualityLabel(signalValue);
      }
    }

    res.json({
      status: 'Nível de Sinal Obtido',
      centralId: centralId,
      command: 'get_signal',
      payload_details: {
        sent: commandHex,
        received: responseHex
      },
      data: {
        raw_hex: responseHex.substring(4, 6), // Ex: "10"
        value: signalValue,                   // Ex: 16
        quality: signalLabel                  // Ex: "Bom"
      }
    });

  } catch (e) {
    res.status(500).json({
      status: 'Falha ao solicitar sinal',
      centralId: centralId,
      command: 'get_signal',
      error: e.message || e,
      hex_sent: commandHex
    });
  }
};