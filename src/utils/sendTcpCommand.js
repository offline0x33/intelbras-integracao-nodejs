// --- FUNÇÃO PARA ENVIAR COMANDOS À CENTRAL (CLIENTE TCP) ---
function sendTcpCommand(commandHex) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();

    console.log(`[CLIENTE TCP] Tentando conectar a ${CENTRAL_IP}:${CENTRAL_PORT} para enviar comando.`);

    client.connect(CENTRAL_PORT, CENTRAL_IP, () => {
      console.log(`[CLIENTE TCP] Conectado. Enviando comando HEX: ${commandHex}`);
      client.write(Buffer.from(commandHex, 'hex'));
    });

    client.on('data', (data) => {
      const responseHex = data.toString('hex');
      console.log(`[CLIENTE TCP] Resposta HEX da Central: ${responseHex}`);

      // Lógica de decodificação da Resposta C0 (Firmware)
      if (responseHex.startsWith('06c0')) {
        const dataPart = responseHex.substring(4, responseHex.length - 2);
        let firmwareVersion = Buffer.from(dataPart, 'hex').toString('ascii');

        resolve({
          success: true,
          responseHex,
          data: firmwareVersion,
          description: `Versão do Firmware: ${firmwareVersion}`
        });
      } else if (responseHex === '06') { // ACK (Reconhecimento de comando)
        resolve({
          success: true,
          responseHex: '06',
          description: 'ACK (Comando Aceito)'
        });
      } else {
        resolve({
          success: true,
          responseHex,
          description: 'Resposta inesperada após comando de controle.'
        });
      }
      client.destroy();
    });

    client.on('error', (err) => {
      console.error(`[CLIENTE TCP] ERRO CRÍTICO de conexão/envio para ${CENTRAL_IP}:${CENTRAL_PORT}: ${err.message}`);
      client.destroy();
      reject({ success: false, error: `Falha na conexão TCP: ${err.code || err.message}` });
    });

    client.on('close', () => {
      console.log('[CLIENTE TCP] Conexão fechada.');
    });

    // Timeout de 5 segundos
    client.setTimeout(5000, () => {
      console.error(`[CLIENTE TCP] TIMEOUT atingido ao tentar conectar a ${CENTRAL_IP}:${CENTRAL_PORT}.`);
      client.destroy();
      reject({ success: false, error: 'Timeout de conexão/resposta após 5 segundos.' });
    });
  });
}

export default sendTcpCommand;