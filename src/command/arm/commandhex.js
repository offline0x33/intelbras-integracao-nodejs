// utils/arm/commandHex.js
import calculateChecksum from "../../utils/checksum.js";

// Mapeamento de Erros NACK (Negative Acknowledge)
const NACK_MAP = {
  'E0': 'Formato de pacote inválido',
  'E1': 'Senha incorreta',
  'E2': 'Comando inválido (Usuário sem permissão)',
  'E3': 'Central não particionada',
  'E4': 'Zonas abertas (Verifique portas e janelas!)',
};

const PARTITION_MAP = {
  0: '',
  1: '41', // Partição A
  2: '42', // Partição B
  3: '43', // Partição C
  4: '44', // Partição D
};

const MODE_MAP = {
  'full': '41', // Comando ISEC Mobile para Ativação Completa
  'stay': '50'  // Comando ISEC Mobile para Ativação Stay
};

/**
 * Monta o payload ISECNet final para ativação.
 * @param {string} partition O número da partição (0-4).
 * @param {string} mode O modo de ativação ('full' ou 'stay').
 * @param {string} passwordHex A senha do usuário em formato hexadecimal (ASCII).
 * @returns {{finalHex: string, isecCommandBody: string}} O comando HEX final e o corpo ISEC para log.
 */
export function buildArmCommand(partition, mode, passwordHex) {
  const modeCommand = MODE_MAP[mode] || MODE_MAP['full'];
  const partitionByte = PARTITION_MAP[parseInt(partition)] || '';

  let isecCommandBody = modeCommand;
  if (partitionByte) {
    isecCommandBody += partitionByte;
  }

  const isecFrame = `21${passwordHex}${isecCommandBody}21`;

  const commandCode = 'E9';
  const frameBytesCount = isecFrame.length / 2;
  const totalBytes = 1 + frameBytesCount;
  const lengthHex = totalBytes.toString(16).padStart(2, '0').toUpperCase();

  const commandCore = `${lengthHex}${commandCode}${isecFrame}`;
  const checksum = calculateChecksum(commandCore);
  const finalHex = `${commandCore}${checksum}`;

  return { finalHex, isecCommandBody };
}

/**
 * Interpreta a resposta HEX da central para comandos de Armar/Desarmar (Comando E9).
 * @param {string} responseHex A string HEX bruta recebida da central.
 * @returns {{status: string, success: boolean}} O status decodificado e o resultado.
 */
export function processArmResponse(responseHex) {
  // A validação de comunicação responseHex.length < 8 já é feita no arm.js

  const lengthDecimal = parseInt(responseHex.substring(0, 2), 16);
  const responseCmd = responseHex.substring(2, 4).toUpperCase();

  let status = 'Aguardando Status';
  let success = false;

  if (responseCmd === 'E9') {

    // CHECK SUCESSO LONGO: Pacote de Status Completo (0xCF ou maior)
    if (lengthDecimal >= 200) {
      status = 'Comando Aceito (Sistema Ativado) - Status Completo Recebido';
      success = true;

    } else {
      // ACK/NACK Curto
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

  return { status, success };
}