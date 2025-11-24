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

// /**
//  * Converte uma string de senha ASCII (ex: "8714") para HEX (ex: "38373134").
//  * @param {string} str A string de texto a ser convertida.
//  * @returns {string} A string hexadecimal resultante.
//  */
// export function asciiToHex(str) {
//   let hex = '';
//   for (let i = 0; i < str.length; i++) {
//     // Pega o código ASCII do caractere e converte para hexadecimal
//     hex += str.charCodeAt(i).toString(16).padStart(2, '0');
//   }
//   return hex.toUpperCase();
// }

// /**
//  * Calcula o checksum (soma de bytes, complemento de dois) para o payload ISECNet V1.
//  * O valor inicial é 0xAA (170) para a soma.
//  * @param {string} payloadHex O payload hexadecimal (sem checksum) para cálculo.
//  * @returns {string} O checksum hexadecimal de 2 caracteres.
//  */
// export default function calculateChecksum(payloadHex) {
//   let sum = 0xAA; // Valor inicial conforme documentação/padrão

//   // Itera sobre o payload em pares de caracteres (bytes)
//   for (let i = 0; i < payloadHex.length; i += 2) {
//     const byteStr = payloadHex.substring(i, i + 2);
//     const byteValue = parseInt(byteStr, 16);
//     sum += byteValue;
//   }

//   // Calcula o complemento de dois: Checksum = (0 - Sum) & 0xFF
//   // Ou, de forma mais simples, pega o byte menos significativo da soma (Sum % 256)
//   // E depois calcula o complemento de dois (0x100 - (Sum % 256))
//   const truncatedSum = sum & 0xFF;
//   const finalChecksum = (0x100 - truncatedSum) & 0xFF;

//   return finalChecksum.toString(16).padStart(2, '0').toUpperCase();
// }