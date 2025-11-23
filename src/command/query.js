// command/query.js
import calculateChecksum from "../utils/checksum.js";
import sendCommandOverExistingSocket from "../utils/protocol.js";

// Mapeamento de comandos e descrição esperada
const QUERY_MAP = {
  'D1': { description: 'Nível de sinal GPRS/3G/4G', rxBytes: 1 }, // image_49c35a.png
  'D3': { description: 'Status de presença do Módulo GPRS/3G/4G', rxBytes: 1 }, // image_49ca25.png
  'C2': { description: 'Modelo da Central de Alarme (Texto)', rxBytes: 1 }, // image_49b0b6.png (RX é variável, mas começa em 1 byte)
  'C4': { description: 'Endereço MAC da Central', rxBytes: 6 }, // image_49b780.png
  'C5': { description: 'IMEI do Módulo GPRS/3G', rxBytes: 15 }, // image_49bb40.png
  'C6': { description: 'ICCID do Chip GPRS/3G', rxBytes: 20 }, // image_49bf00.png
};

export default (activeSockets) => async (req, res) => {
  // Recebe o ID da central e o código do comando a ser solicitado (ex: D1, C4)
  const { centralId, commandCode } = req.params;
  const targetSocket = activeSockets[centralId];
  const commandInfo = QUERY_MAP[commandCode.toUpperCase()];

  // 1. Validação
  if (!targetSocket) {
    return res.status(404).json({
      status: 'Central Offline',
      error: `Central ID ${centralId} não está conectada ao Servidor TCP.`
    });
  }

  if (!commandInfo) {
    return res.status(400).json({
      status: 'Comando Inválido',
      error: `O código de comando '${commandCode}' não é um comando de consulta (Query) reconhecido.`,
      available_commands: Object.keys(QUERY_MAP)
    });
  }

  // --- MONTAGEM DO PAYLOAD (Padrão: Comprimento + Comando + Checksum) ---
  // A documentação mostra que comandos de solicitação têm:
  // Tx: 01 byte (Comprimento) + Comando (1 byte) + Checksum (1 byte)
  // Exemplo D1: 01 D1 2F (3 bytes total, onde o ISECNet Length é 01)

  const txCommand = commandCode.toUpperCase();
  const lengthHex = '01'; // O comprimento do payload ISECNet V1 é 1 byte (o próprio comando)

  const commandCore = `${lengthHex}${txCommand}`;
  const checksum = calculateChecksum(commandCore);
  const commandHex = `${commandCore}${checksum}`;

  // --- ENVIO E PROCESSAMENTO DA RESPOSTA ---
  try {
    const rawResponse = await sendCommandOverExistingSocket(targetSocket, commandHex);

    let responseHex = '';

    if (typeof rawResponse === 'object' && rawResponse !== null && rawResponse.responseHex) {
      responseHex = rawResponse.responseHex;
    } else if (typeof rawResponse === 'string') {
      responseHex = rawResponse;
    }

    // Validação de Comunicação
    if (!responseHex || responseHex.length < 6) { // 6 bytes: Len + Cmd + Data (1 byte) + Cks
      const receivedValue = typeof rawResponse === 'object' ? JSON.stringify(rawResponse) : rawResponse;
      throw new Error(`Falha de comunicação ou resposta vazia. Recebido: ${receivedValue}`);
    }

    // Decodifica a Resposta (Ex: 02 D1 01 2F)
    const lengthHexRx = responseHex.substring(0, 2);
    const responseCmd = responseHex.substring(2, 4).toUpperCase();
    const dataHex = responseHex.substring(4, responseHex.length - 2); // Exclui Len, Cmd e ChkSum

    let decodedValue = dataHex;
    let description = commandInfo.description;

    // Tenta decodificar o valor baseado no comando
    if (responseCmd === txCommand) {

      // Comandos de Status (D1, D3)
      if (['D1', 'D3'].includes(txCommand)) {
        const dataByte = dataHex.substring(0, 2);
        if (txCommand === 'D3') {
          // Status de Presença do Módulo GPRS/3G (image_49ca25.png)
          decodedValue = dataByte === '01' ? 'Presente' : (dataByte === '00' ? 'Ausente' : dataHex);
        } else if (txCommand === 'D1') {
          // Nível de Sinal (RSSi)
          decodedValue = parseInt(dataByte, 16).toString(); // Converte HEX (Ex: 0A) para Decimal (10)
          description = `Nível de Sinal (RSSi): ${decodedValue} / HEX: ${dataByte}`;
        }
      }

      // Comandos de Identificação (C2, C4, C5, C6)
      if (['C2', 'C4', 'C5', 'C6'].includes(txCommand)) {
        if (txCommand === 'C2') {
          // Modelo da Central (Texto ASCII) - image_49b0b6.png
          // Ex: 414D542038303030 -> 'AMT 8000'
          const hexBuffer = Buffer.from(dataHex, 'hex');
          decodedValue = hexBuffer.toString('ascii').trim();
        } else {
          // MAC/IMEI/ICCID: São retornados como HEX puro, que é o que queremos.
          decodedValue = dataHex.toUpperCase();
        }
      }

    } else {
      // Resposta inesperada (ex: a central enviou E9 em vez de D1)
      status = `Comando Inesperado: A central respondeu ${responseCmd} em vez de ${txCommand}`;

      return res.status(500).json({
        status: status,
        command: 'query_system',
        error: dataHex,
        payload_details: { sent: commandHex, received: responseHex }
      });
    }

    res.json({
      status: 'Sucesso',
      command: 'query_system',
      centralId: centralId,
      query_type: description,
      decoded_value: decodedValue,
      payload_details: {
        sent: commandHex,
        received: responseHex,
        data_hex: dataHex,
        rx_length_hex: lengthHexRx
      }
    });

  } catch (e) {
    res.status(500).json({
      status: 'Falha ao solicitar informação',
      error: e.message || e,
      hex_sent: commandHex
    });
  }
};