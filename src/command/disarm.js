// command/disarm.js
import calculateChecksum, { asciiToHex } from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// --- Mapeamento de Erros NACK (Negative Acknowledge) ---
const NACK_MAP = {
  'E0': 'Formato de pacote inválido',
  'E1': 'Senha incorreta',
  'E2': 'Comando inválido (Ex: Usuário sem permissão)',
  'E3': 'Central não particionada',
  'E4': 'Zonas abertas (Este erro não deve ocorrer no Desarmar, mas é mapeado)',
};
// --------------------------------------------------------

// Mapeamento de Partições para o byte de dados ISECMobile (0x41 a 0x44)
const PARTITION_MAP = {
  0: null,  // 0 ou null = Sistema Inteiro (Sem byte de partição)
  1: '41',  // Partição A
  2: '42',  // Partição B
  3: '43',  // Partição C
  4: '44',  // Partição D
};

// Caso	Conteúdo do contentData
// Desarmar Completo(partition: 0)	44
// Desarmar Partição A(partition: 1)	4441
// Comando interno para DESATIVAÇÃO
const DEACTIVATION_COMMAND = '44';

export default (activeSockets) => async (req, res) => {
  // Lê os parâmetros da rota GET
  const { centralId, partition, user: password } = req.params;
  const targetSocket = activeSockets[centralId];

  console.log('Desarmar sistema - Parâmetros recebidos:', { centralId, partition, password });

  // 1. Validações Iniciais
  if (!targetSocket) {
    return res.status(404).json({
      status: 'Central Offline',
      error: `Central ID ${centralId} não está conectada ao Servidor TCP.`
    });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Senha de 4 a 6 dígitos é obrigatória.' });
  }

  // --- MONTAGEM DO PAYLOAD ---

  // Converte a senha para HEX (ASCII)
  const passwordHex = asciiToHex(password);

  // 2. Constrói o Corpo do Comando (ISECMobile)
  const partitionByte = PARTITION_MAP[partition] || '';

  // Estrutura: Comando 40 + [Byte da Partição]
  let contentData = DEACTIVATION_COMMAND;
  if (partitionByte) {
    contentData += partitionByte;
  }

  // 3. Monta o FRAME ISECMobile (21 + Senha + Conteúdo + 21)
  const isecMobileFrame = `21${passwordHex}${contentData}21`;

  // 4. Monta o PAYLOAD ISECNet (Comprimento + Comando E9 + Dados ISECMobile)
  const commandCode = 'E9';
  const frameBytesCount = isecMobileFrame.length / 2;
  const totalDataBytes = 1 + frameBytesCount;
  const lengthHex = totalDataBytes.toString(16).padStart(2, '0').toUpperCase();

  const commandCore = `${lengthHex}${commandCode}${isecMobileFrame}`;
  const checksum = calculateChecksum(commandCore);
  const commandHex = `${commandCore}${checksum}`;

  // --- ENVIO E PROCESSAMENTO DA RESPOSTA ---

  try {
    const rawResponse = await sendCommandOverExistingSocket(targetSocket, commandHex);

    let responseHex = '';

    // Extrai o HEX da resposta (lidando com strings e objetos)
    if (typeof rawResponse === 'object' && rawResponse !== null && rawResponse.responseHex) {
      responseHex = rawResponse.responseHex;
    } else if (typeof rawResponse === 'string') {
      responseHex = rawResponse;
    }

    // Validação de Comunicação
    if (!responseHex || responseHex.length < 8) {
      const receivedValue = typeof rawResponse === 'object' ? JSON.stringify(rawResponse) : rawResponse;
      throw new Error(`Falha de comunicação ou resposta vazia. Recebido: ${receivedValue}`);
    }

    // 1. Decodifica o Tamanho e Comando
    const lengthDecimal = parseInt(responseHex.substring(0, 2), 16);
    const responseCmd = responseHex.substring(2, 4).toUpperCase();

    let status = 'Aguardando Status';
    let success = false;

    // 2. Lógica de Decodificação (Igual ao arm.js)
    if (responseCmd === 'E9') {

      // 🛑 CHECK SUCESSO LONGO: Pacote de Status Completo (0xCF = 207 bytes)
      if (lengthDecimal >= 200) {
        status = 'Comando Aceito (Sistema Desativado) - Status Completo Recebido';
        success = true;

      } else {
        // ACK/NACK Curto (2 bytes)
        const dataByte = responseHex.substring(4, 6).toUpperCase();

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
      command: 'disarm_system',
      config_sent: {
        partition: partition || 'Full',
        raw_isec_body: contentData
      },
      payload_details: {
        sent: commandHex,
        received: responseHex
      }
    });

  } catch (e) {
    res.status(500).json({
      status: 'Falha ao enviar comando de desativação',
      error: e.message || e,
      hex_sent: commandHex
    });
  }
};