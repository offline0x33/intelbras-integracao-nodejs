// command/arm.js
import calculateChecksum, { asciiToHex } from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// Mapeamento de Partições para o byte de dados ISECMobile (0x41 a 0x44)
const PARTITION_MAP = {
  1: '41', // Partição A
  2: '42', // Partição B
  3: '43', // Partição C
  4: '44', // Partição D
};

export default (activeSockets) => async (req, res) => {
  // ATENÇÃO: 'user' AGORA DEVE SER A SENHA DE CONTROLE DA CENTRAL
  const { centralId, partition, user: password } = req.params;

  const targetSocket = activeSockets[centralId];

  if (!targetSocket) {
    return res.status(404).json({
      status: 'Central Offline',
      error: `Central ID ${centralId} não está conectada ao Servidor TCP.`,
      tip: 'A central deve enviar um evento (Teste, Keep-Alive, etc.) para estabelecer a conexão.'
    });
  }

  // 1. Converte a senha para HEX (ASCII)
  const passwordHex = asciiToHex(password);

  // 2. Define o Conteúdo (Partição) do ISECMobile
  const partitionNumber = parseInt(partition);
  const partitionData = PARTITION_MAP[partitionNumber];

  // O comando 0x41 (Ativação) é o comando interno do ISECMobile
  const commandActivation = '41';

  let contentData;
  if (partitionData) {
    // Ativação de Partição específica: Comando 41 + Byte da Partição
    contentData = `${commandActivation}${partitionData}`;
  } else {
    // Ativação Completa: Comando 41, sem byte de partição extra (conforme documentação)
    contentData = commandActivation;
  }

  // 3. Monta o FRAME ISECMobile (Início 21 + Senha + Comando + Fim 21)
  const isecMobileFrame = `21${passwordHex}${contentData}21`;

  // 4. Monta o PAYLOAD ISECNet (Comprimento + Comando E9 + Dados ISECMobile)

  // Comando E9 (ISECNet)
  const commandCode = 'E9';

  // --- CORREÇÃO CRÍTICA DO COMPRIMENTO ---
  // A AMT exige o comprimento de (Comando E9 + Dados ISECMobile)
  const totalDataBytes = 1 + (isecMobileFrame.length / 2); // 1 byte (E9) + Bytes do Frame ISECMobile
  const lengthHex = totalDataBytes.toString(16).padStart(2, '0').toUpperCase();

  const commandCore = `${lengthHex}${commandCode}${isecMobileFrame}`;
  const checksum = calculateChecksum(commandCore);
  const commandHex = `${commandCore}${checksum}`;
  // Exemplo para Partição 1, senha 8714: 09 E9 21 38373134 4141 21 XX (XX = Checksum)

  try {
    const result = await sendCommandOverExistingSocket(targetSocket, commandHex);
    res.json({
      status: 'Comando Armar enviado (ISECNet)',
      centralId: centralId,
      command: 'arm',
      payload_details: {
        command_code: commandCode,
        isec_mobile_frame: isecMobileFrame,
        partition: partitionData ? `Partição ${partition}` : 'Completa',
        length: lengthHex
      },
      hex_sent: commandHex,
      data: result
    });
  } catch (e) {
    res.status(500).json({
      status: 'Falha ao enviar comando',
      centralId: centralId,
      command: 'arm',
      error: e.error,
      hex_sent: commandHex
    });
  }
};