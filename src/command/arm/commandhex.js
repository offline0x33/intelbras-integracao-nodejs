// utils/arm/commandHex.js
import calculateChecksum from "../../utils/checksum.js";

// Mapeamento de Erros NACK (Negative Acknowledge)
const NACK_MAP = {
  'E0': 'Formato de pacote inválido',
  'E1': 'Senha incorreta',
  'E2': 'Comando inválido (Usuário sem permissão)',
  'E3': 'Central não particionada',
  'E4': 'Zonas abertas (Verifique portas e janelas!)',
  'E5': 'Comando descontinuado',
  'E6': 'Usuário sem permissão para bypass',
  'E7': 'Usuário sem permissão para desativar',
  'E8': 'Bypass não permitido com a central ativada',
};

const PARTITION_MAP = {
  0: '',   // NULL – Ativa a central completa
  1: '41', // Partição A
  2: '42', // Partição B
  3: '43', // Partição C
  4: '44', // Partição D
};
// 0B E9 21 38 37 38 37 38 37 41 42 21 XX - Comando para ativar a partição B com senha de 6 dígitos.
// No Bytes: 0B - Tamanho do pacote (11 bytes)
// Comando: E9 - Comando de Ativação ISECNet
// Payload ISECNet: 21 38 37 38 37 38 37 41 42 21
// Checksum: XX - Checksum calculado

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
  const modeCommand = MODE_MAP[mode] || MODE_MAP['full']; // Default para 'full' se modo inválido
  const partitionByte = PARTITION_MAP[parseInt(partition)] || ''; // Mapeia a partição ou vazio para 0 (completa)

  let isecCommandBody = modeCommand; // Começa com o comando de modo
  if (partitionByte) {
    isecCommandBody += partitionByte; // Adiciona o byte da partição se aplicável
  }

  const isecFrame = `21${passwordHex}${isecCommandBody}21`; // Payload ISECNet: 21 38 37 38 37 38 37 41 42 21

  const commandCode = 'E9'; // Comando de Ativação ISECNet
  const frameBytesCount = isecFrame.length / 2; // Cada 2 chars HEX = 1 byte
  const totalBytes = 1 + frameBytesCount; // 1 byte para o comando + payload ISECNet
  const lengthHex = totalBytes.toString(16).padStart(2, '0').toUpperCase(); // Tamanho do pacote em HEX

  const commandCore = `${lengthHex}${commandCode}${isecFrame}`; // Comando sem checksum
  const checksum = calculateChecksum(commandCore); // Calcula o checksum
  const finalHex = `${commandCore}${checksum}`; // Comando final com checksum

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