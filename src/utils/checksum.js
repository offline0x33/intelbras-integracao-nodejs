// utils/checksum.js

const XOR_MASK = 0xFF; // Máscara XOR final para o checksum

/**
 * Converte uma string ASCII (como a senha) para sua representação HEX.
 * @param {string} str A string a ser convertida.
 * @returns {string} A representação hexadecimal.
 */
function asciiToHex(str) {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16);
  }
  return hex.toUpperCase();
}


/**
 * Calcula o Checksum de um comando AMT (XOR de todos os bytes ^ 0xFF).
 * @param {string} hexData String Hexadecimal dos dados a serem verificados (Comprimento + Comando + Dados).
 * @returns {string} O checksum em formato hexadecimal de 2 caracteres (ex: '3E').
 */
export default function calculateChecksum(hexData) {
  // 1. Converte a string HEX para um Buffer de bytes.
  const dataBuffer = Buffer.from(hexData, 'hex');

  let xor = 0;
  // 2. Itera sobre os bytes e calcula o XOR cumulativo
  for (const byte of dataBuffer) {
    xor ^= byte;
  }

  // 3. Aplica o XOR final com 0xFF
  const finalChecksumByte = xor ^ XOR_MASK;

  // 4. Retorna o resultado em formato hexadecimal de 2 caracteres
  return finalChecksumByte.toString(16).padStart(2, '0').toUpperCase();
}

// Exporta também a função auxiliar para uso nos handlers
export { asciiToHex };