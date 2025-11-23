// tcpServer.js
import net from 'net';
import { findAndDecodeEvents } from './utils/event.js';
import activeSockets from './utils/activeSocket.js';

// --- SERVIDOR TCP PARA RECEBER EVENTOS DA AMT 2018 ---
const server = net.createServer((socket) => {

  const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[TCP SERVER] Nova conexão estabelecida: ${clientAddress}`);

  // Configuração inicial do socket (usaremos a CONTA/ID da Central)
  let centralId = '';

  socket.on('data', (data) => {
    const rawEvent = data.toString('hex');
    console.log(`[TCP SERVER] Evento bruto (HEX) recebido de ${clientAddress}: ${rawEvent}`);

    const sendAck = () => {
      // ACK Padrão da Intelbras é 0x06
      socket.write(Buffer.from('06', 'hex'));
      console.log('[TCP SERVER] ACK (0x06) enviado para a Central.');
    };

    try {
      // Usa o parser robusto para lidar com Keep-Alive, Contact ID e o pacote estendido (62 chars)
      const { decodedEvents, shouldSendAck, centralId: eventCentralId } = findAndDecodeEvents(rawEvent);

      if (eventCentralId) {
        // PASSO CHAVE: Extrai o ID (Conta) e SALVA/ATUALIZA o socket
        centralId = eventCentralId;
        activeSockets[centralId] = socket;
        console.log(`[SOCKET MGR] Socket salvo/atualizado para o ID: ${centralId}`);
      }

      for (const decodedEvent of decodedEvents) {
        if (decodedEvent.type && decodedEvent.type.startsWith('Pacote Estendido')) {
          console.log(`[LÓGICA] Pacote Estendido recebido (Provavelmente Arme/Desarme APP). ID da Central: ${decodedEvent.account}.`);
        } else {
          console.log(`[LÓGICA] Evento Decodificado: Conta: ${decodedEvent.account} | Tipo: ${decodedEvent.type} | Zona/Usuário: ${decodedEvent.zone}`);
        }
      }

      if (shouldSendAck) {
        // Se o parser encontrou f7, 18 chars, ou 62 chars, ele nos pediu para enviar o ACK.
        sendAck();
      } else if (rawEvent.length > 0) {
        // Log para pacotes totalmente desconhecidos que não geraram ACK
        console.warn(`[LÓGICA] Pacote HEX de tamanho ${rawEvent.length} não reconhecido e sem ACK enviado: ${rawEvent}`);
      }

    } catch (e) {
      console.error(`[LÓGICA] Erro fatal no processamento: ${e.message}`);
    }
  });

  // Gerenciamento de Sockets - Desconexão
  socket.on('end', () => {
    console.log(`[TCP SERVER] Fim da conexão com ${clientAddress}`);
    if (centralId) {
      delete activeSockets[centralId];
      console.log(`[SOCKET MGR] Conexão encerrada. Socket do ID ${centralId} removido.`);
    }
  });

  // Gerenciamento de Sockets - Erro
  socket.on('error', (err) => {
    console.error(`[TCP SERVER] Erro de conexão com ${clientAddress}: ${err.message}`);
    if (centralId && activeSockets[centralId]) {
      delete activeSockets[centralId];
      console.log(`[SOCKET MGR] Socket do ID ${centralId} removido devido a erro.`);
    }
  });

});


export default server;