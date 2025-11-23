// command/firmware.js
import calculateChecksum from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// Recebe activeSockets e retorna o handler de rota do Express (req, res)
export default (activeSockets) => async (req, res) => {
  const { centralId } = req.params;
  const targetSocket = activeSockets[centralId]; // activeSockets agora está definido!

  if (!targetSocket) {
    return res.status(404).json({
      status: 'Central Offline',
      error: `Central ID ${centralId} não está conectada ao Servidor TCP.`,
      tip: 'A central deve enviar um evento (Teste, Keep-Alive, etc.) para estabelecer a conexão.'
    });
  }

  // Comando C0 (Solicita versão firmware): 01 C0 3E
  const commandCore = '01C0';
  const checksum = calculateChecksum(commandCore);
  const commandHex = `${commandCore}${checksum}`;

  try {
    const result = await sendCommandOverExistingSocket(targetSocket, commandHex);
    res.json({
      status: 'Comando enviado com sucesso',
      centralId: centralId,
      command: 'firmware',
      data: result
    });
  } catch (e) {
    res.status(500).json({
      status: 'Falha ao enviar comando',
      centralId: centralId,
      command: 'firmware',
      error: e.error
    });
  }
};