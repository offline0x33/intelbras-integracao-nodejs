// command/getICCID.js
import calculateChecksum from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// Função auxiliar para converter HEX para Texto (ASCII)
// O ICCID vem como texto (ex: 38='8', 39='9')
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

  // 1. Comando C6 (Solicita ICCID)
  const commandCode = 'C6';

  // 2. Num Bytes (Tx na imagem é 01)
  const lengthHex = '01';

  // 3. Núcleo do comando
  const commandCore = `${lengthHex}${commandCode}`;

  // 4. Calcula Checksum (Ex da imagem: 01 + C6 = 38 na lógica checksum)
  const checksum = calculateChecksum(commandCore);

  // 5. Comando Completo
  const commandHex = `${commandCore}${checksum}`;

  try {
    const responseHex = await sendCommandOverExistingSocket(targetSocket, commandHex);

    // --- PROCESSAMENTO DA RESPOSTA (Rx) ---
    // Exemplo Imagem Rx: 15 C6 38 39 35 ... 21
    // 15 (Hex) = 21 (Decimal) -> Tamanho total dos dados
    // C6 = Comando de retorno
    // 38 39... = Dados (ICCID em ASCII)
    // 21 = Checksum (exemplo)

    let iccidString = 'Não identificado';

    // Validação:
    // Header (2 chars Tamanho + 2 chars Comando) = 4 chars
    // ICCID (20 bytes * 2 chars) = 40 chars
    // Checksum = 2 chars
    // Total esperado >= 46 chars

    if (responseHex && responseHex.length >= 46) {
      const responseCmd = responseHex.substring(2, 4);

      if (responseCmd === 'C6') {
        // Extrai os dados:
        // Começa no índice 4 (pula header)
        // Vai até length-2 (remove checksum)
        const dataHex = responseHex.substring(4, responseHex.length - 2);

        // Converte de Hex ASCII para String legível
        iccidString = hexToAscii(dataHex);
      }
    }

    res.json({
      status: 'ICCID Obtido',
      centralId: centralId,
      command: 'get_iccid',
      payload_details: {
        sent: commandHex,
        received: responseHex
      },
      data: {
        iccid: iccidString // Retorna ex: "8955..."
      }
    });

  } catch (e) {
    res.status(500).json({
      status: 'Falha ao solicitar ICCID',
      centralId: centralId,
      command: 'get_iccid',
      error: e.message || e,
      hex_sent: commandHex
    });
  }
};