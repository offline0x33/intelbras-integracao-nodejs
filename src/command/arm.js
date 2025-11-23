// command/arm.js (VERSÃO FINAL E ROBUSTA)
import calculateChecksum, { asciiToHex } from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// --- Mapeamento de Erros NACK (Negative Acknowledge) ---
const NACK_MAP = {
  'E0': 'Formato de pacote inválido',
  'E1': 'Senha incorreta',
  'E2': 'Comando inválido (Ex: Usuário sem permissão)',
  'E3': 'Central não particionada', // SEU ERRO ATUAL!
  'E4': 'Zonas abertas (Verifique portas e janelas!)',
};
// --------------------------------------------------------

const PARTITION_MAP = {
  0: null,
  1: '41',
  2: '42',
  3: '43',
  4: '44',
};
const STAY_MODE_BYTE = '50';

export default (activeSockets) => async (req, res) => {
  const { centralId, user: password, partition, mode } = req.params;
  const targetSocket = activeSockets[centralId];

  console

  // ... (Geração do commandHex aqui) ...
  const passwordHex = asciiToHex(password);
  let isecCommandBody = '41';
  const partitionByte = PARTITION_MAP[partition] || '';
  if (partitionByte) {
    isecCommandBody += partitionByte;
  }
  if (mode === 'stay') {
    isecCommandBody += STAY_MODE_BYTE;
  }
  const isecFrame = `21${passwordHex}${isecCommandBody}21`;
  const commandCode = 'E9';
  const frameBytesCount = isecFrame.length / 2;
  const totalBytes = 1 + frameBytesCount;
  const lengthHex = totalBytes.toString(16).padStart(2, '0').toUpperCase();
  const commandCore = `${lengthHex}${commandCode}${isecFrame}`;
  const checksum = calculateChecksum(commandCore);
  const commandHex = `${commandCore}${checksum}`;
  // --------------------------------------------------------

  try {
    const rawResponse = await sendCommandOverExistingSocket(targetSocket, commandHex);

    let responseHex = '';

    // 1. Extrai o HEX da resposta
    if (typeof rawResponse === 'object' && rawResponse !== null && rawResponse.responseHex) {
      responseHex = rawResponse.responseHex;
    } else if (typeof rawResponse === 'string') {
      responseHex = rawResponse;
    }

    // 2. Validação final de comunicação (Garante que responseHex é uma string)
    if (!responseHex || responseHex.length < 8) {
      const receivedValue = typeof rawResponse === 'object' ? JSON.stringify(rawResponse) : rawResponse;
      throw new Error(`Falha de comunicação ou resposta vazia. Recebido: ${receivedValue}`);
    }

    // 🛑 CORREÇÃO: DECLARE E CALCULE lengthDecimal AQUI 🛑
    // Converte a string hex do tamanho (primeiros dois caracteres) para Decimal
    const lengthDecimal = parseInt(responseHex.substring(0, 2), 16);
    // --------------------------------------------------------------------

    // --- PROCESSAMENTO DA RESPOSTA ---
    let status = 'Aguardando Status';
    let success = false;

    const responseCmd = responseHex.substring(2, 4).toUpperCase();

    if (responseCmd === 'E9') {

      // 3. NOVO CHECK: Usa a variável lengthDecimal, que agora está definida
      if (lengthDecimal >= 200) {
        status = 'Comando Aceito (Sistema Ativado) - Status Completo Recebido';
        success = true;

      } else {
        // SE NÃO FOR O LONGO, PROCESSA O PACOTE CURTO (ACK/NACK)
        const dataByte = responseHex.substring(4, 6).toUpperCase();

        // ... (Lógica de FE e NACK_MAP) ...
        if (dataByte === 'FE') {
          status = 'Comando Aceito (Confirmação Curta FE)';
          success = true;
        } else if (NACK_MAP[dataByte]) {
          status = `FALHA (NACK ${dataByte}): ${NACK_MAP[dataByte]}`;
          success = false;
        } else {
          status = `Retorno não reconhecido: ${dataByte}`;
          success = false;
        }
      }
    } else {
      status = `Resposta de comando inesperado: ${responseCmd}`;
      success = false;
    }


    res.json({
      status: status,
      success: success,
      centralId: centralId,
      command: 'arm_system',
      // ... (Restante do payload) ...
      config_sent: {
        partition: partition || 'Full',
        mode: mode || 'Normal',
        raw_isec_body: isecCommandBody
      },
      payload_details: {
        sent: commandHex,
        received: responseHex
      }
    });

  } catch (e) {
    res.status(500).json({
      status: 'Falha ao enviar comando de ativação',
      // Agora, o 'e.message' deve conter a mensagem de erro específica do throw (se houver)
      error: e.message || e,
      hex_sent: commandHex
    });
  }
};