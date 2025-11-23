// command/getIMEI.js
import calculateChecksum from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// Função auxiliar para converter HEX para Texto (ASCII)
// Necessária pois o IMEI vem como caracteres codificados (ex: 33='3', 35='5')
function hexToAscii(hex) {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substr(i, 2), 16);
    if (code !== 0) {
      str += String.fromCharCode(code);
    }
  }
  return str;
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

    // 1. Comando C5 (Solicita IMEI)
  const commandCode = 'C5';

  // 2. Num Bytes (Tx na imagem é 01)
  // O frame contém apenas o byte do comando.
  const lengthHex = '01';

  // 3. Núcleo do comando
  const commandCore = `${lengthHex}${commandCode}`;

  // 4. Calcula Checksum (Ex da imagem: 01 + C5 = 3B)
  const checksum = calculateChecksum(commandCore);

  // 5. Comando Completo
  const commandHex = `${commandCore}${checksum}`;

  try {
    const responseHex = await sendCommandOverExistingSocket(targetSocket, commandHex);

    // --- PROCESSAMENTO DA RESPOSTA (Rx) ---
    // Exemplo Imagem Rx: 10 C5 33 35 36 34 34 39 ... 1A
    // 10 = Tamanho (16 em decimal). Isso ocorre porque são 15 bytes de IMEI + 1 byte de Comando.
    // C5 = Comando de retorno
    // 33 35 ... = Dados (IMEI em ASCII)
    // 1A = Checksum

    let imeiString = 'Não identificado';

    // Validação:
    // Header (2 chars tamanho + 2 chars comando) = 4 chars
    // IMEI (15 bytes * 2 chars) = 30 chars
    // Checksum = 2 chars
    // Total esperado = 36 chars

    if (responseHex && responseHex.length >= 36) {
      const responseCmd = responseHex.substring(2, 4);

      if (responseCmd === 'C5') {
        // Extrai os dados (pula os 4 primeiros chars de header e remove os 2 últimos de checksum)
        const dataHex = responseHex.substring(4, responseHex.length - 2);

        // Converte de Hex (3335...) para String ("35...")
        imeiString = hexToAscii(dataHex);
      }
    }

    res.json({
      status: 'IMEI Obtido',
      centralId: centralId,
      command: 'get_imei',
      payload_details: {
        sent: commandHex,
        received: responseHex
      },
      data: {
        imei: imeiString // Retorna ex: "356449060287389"
      }
    });

  } catch (e) {
    res.status(500).json({
      status: 'Falha ao solicitar IMEI',
      centralId: centralId,
      command: 'get_imei',
      error: e.message || e,
      hex_sent: commandHex
    });
  }
};