import calculateChecksum from "../../utils/checksum.js";

// Código do comando para verificação do módulo GPRS
export const CHECK_GPRS_COMMAND = 'D3';

// Mapeamento de Status Genérico (00/01)
const STATUS_MAP = {
  '00': { text: 'Ausente', isPresent: false },
  '01': { text: 'Presente', isPresent: true },
};

/**
 * Constrói um comando ISECNet simples de 1 byte de comprimento (01 + Comando).
 * @param {string} commandCode O código do comando HEX (Ex: 'D3').
 * @returns {string} O comando HEX completo com checksum.
 */
export function buildSimpleQueryCommand(commandCode) {
  const lengthHex = '01';
  const commandCore = `${lengthHex}${commandCode}`;
  const checksum = calculateChecksum(commandCore);
  return `${commandCore}${checksum}`;
}

/**
 * Processa a resposta de um módulo simples de 1 byte (Ex: D3).
 * @param {string} responseHex A string HEX bruta recebida da central.
 * @param {string} expectedCommand O comando esperado na resposta (Ex: 'D3').
 * @returns {{raw_val: string, text: string, is_present: boolean, status: string}}
 */
export function processModuleQueryResponse(responseHex, expectedCommand) {

  const responseCmd = responseHex.substring(2, 4).toUpperCase();

  if (responseCmd !== expectedCommand) {
    return {
      status: `Resposta de comando inesperado: ${responseCmd}. Esperado: ${expectedCommand}.`,
      raw_val: 'FF',
      text: 'Erro de Protocolo',
      is_present: false
    };
  }

  const statusRaw = responseHex.substring(4, 6).toUpperCase();
  const statusData = STATUS_MAP[statusRaw] || { text: 'Desconhecido', isPresent: false };

  return {
    status: 'Verificação de Módulo Concluída',
    raw_val: statusRaw,
    text: statusData.text,
    is_present: statusData.isPresent,
  };
}