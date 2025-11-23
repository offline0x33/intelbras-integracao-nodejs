// command/getModel.js
import calculateChecksum from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// Função auxiliar para converter a resposta HEX para Texto (ASCII)
// Ex: "414D54" -> "AMT"
function hexToAscii(hex) {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substr(i, 2), 16);
    // Ignora bytes nulos (00) que podem vir no final como padding
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

  // Montagem do comando para solicitar o modelo da central
  // 1. Comando C2 (Solicita modelo)
  const commandCode = 'C2';

  // 2. Num Bytes (Comprimento)
  // Pela imagem (Tx), o Num Bytes é 01.
  // Isso significa que o tamanho do frame de dados é 1 (apenas o byte do comando C2).
  const lengthHex = '01';

  // 3. Monta o núcleo do comando para cálculo do Checksum
  // Estrutura: [Tamanho 1 byte] [Comando 1 byte] [Dados - Inexistentes neste caso]
  const commandCore = `${lengthHex}${commandCode}`;

  // 4. Calcula Checksum (Conforme exemplo da imagem: 01 + C2 = Checksum 3C)
  const checksum = calculateChecksum(commandCore);

  // 5. Comando Final
  const commandHex = `${commandCore}${checksum}`;

  try {
    // Envia e aguarda resposta
    const responseHex = await sendCommandOverExistingSocket(targetSocket, commandHex);

    // --- PROCESSAMENTO DA RESPOSTA (Rx) ---
    // Exemplo Imagem Rx: 0A C2 41 4D 54 20 38 30 30 30 00 47
    // 0A = Tamanho (10 bytes)
    // C2 = Comando de retorno
    // 41...00 = Dados (Modelo "AMT 8000")
    // 47 = Checksum

    let modelName = 'Desconhecido';

    // Validação básica se a resposta contém dados
    if (responseHex && responseHex.length > 4) {
      // Remove o Byte de Tamanho (2 chars), Byte de Comando (2 chars) e Checksum (2 chars)
      // Header = 4 chars (Ex: 0AC2)
      // Checksum = últimos 2 chars

      // Verifica se o retorno é realmente do comando C2
      const responseCmd = responseHex.substring(2, 4);

      if (responseCmd === 'C2') {
        // Extrai apenas os dados (do índice 4 até o final - 2)
        const dataHex = responseHex.substring(4, responseHex.length - 2);
        modelName = hexToAscii(dataHex).trim();
      }
    }

    res.json({
      status: 'Modelo Obtido com Sucesso',
      centralId: centralId,
      command: 'get_model',
      payload_details: {
        sent: commandHex,
        received: responseHex
      },
      model: modelName // Retorna ex: "AMT 8000"
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