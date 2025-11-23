// utils/protocol.js
import net from 'net';

// Constantes de Protocolo
const ACK = '06'; // Acknowledge

/**
 * Envia um comando HEX usando um socket TCP JÁ ESTABELECIDO pela Central (solução para CGNAT).
 * O comando é enviado como o payload HEX bruto, sem encapsulamento STX/ETX.
 * @param {net.Socket} socket O socket ativo da Central.
 * @param {string} commandHex O comando completo em HEX (Comprimento + Comando + Dados + Checksum).
 * @returns {Promise<object>} Resultado da operação e resposta da Central.
 */
export default function sendCommandOverExistingSocket(socket, commandHex) {
  return new Promise((resolve, reject) => {

    // 1. O comando é enviado como está (payload HEX bruto)
    const finalHexToSend = commandHex;

    console.log(`[EXISTING SOCKET] Enviando comando HEX (Payload Bruto): ${finalHexToSend}`);

    // Timeout de resposta para este comando específico
    const COMMAND_TIMEOUT = 5000;

    // Listener temporário para processar a resposta
    const temporaryDataListener = (data) => {
      const responseHex = data.toString('hex');
      console.log(`[EXISTING SOCKET] Resposta HEX da Central: ${responseHex}`);

      // Remove o listener de dados e desativa o timeout após a resposta
      socket.removeListener('data', temporaryDataListener);
      socket.setTimeout(0);

      // 2. Lógica de tratamento da resposta:

      // A. Se a resposta for um ACK simples (06), o comando foi aceito
      if (responseHex.toLowerCase() === ACK) {
        return resolve({
          success: true,
          responseHex: ACK,
          data: 'ACK',
          description: 'ACK: Comando Aceito pela Central.'
        });
      }

      // B. Tratamento para respostas de dados (ex: Comando C0 - Firmware)
      let dataPart = responseHex.substring(4, responseHex.length - 2);
      let description = 'Resposta de Controle (Não-ACK simples)';

      if (responseHex.toLowerCase().startsWith(`${ACK}c0`)) { // Resposta do Comando C0 (Firmware)
        let firmwareVersion = Buffer.from(dataPart, 'hex').toString('ascii');
        description = `Versão do Firmware: ${firmwareVersion}`;
        dataPart = firmwareVersion;
      }

      resolve({
        success: true,
        responseHex,
        data: dataPart,
        description: description
      });
    };

    // Listener de erro para esta transação
    const errorListener = (err) => {
      // Limpa todos os listeners temporários
      socket.removeListener('data', temporaryDataListener);
      socket.removeListener('error', errorListener);
      socket.setTimeout(0);
      reject({ success: false, error: `Erro no socket persistente: ${err.message}` });
    };

    // Adiciona listeners para esta transação
    socket.once('data', temporaryDataListener);
    socket.once('error', errorListener);

    // Configura o timeout para a resposta
    socket.setTimeout(COMMAND_TIMEOUT, () => {
      socket.removeListener('data', temporaryDataListener);
      socket.removeListener('error', errorListener);
      reject({ success: false, error: 'Timeout de resposta após 5 segundos.' });
    });

    // ENVIA o comando (payload HEX bruto)
    socket.write(Buffer.from(finalHexToSend, 'hex'));
  });
}