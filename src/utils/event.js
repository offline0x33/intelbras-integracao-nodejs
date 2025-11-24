// utils/event.js

// Tamanhos de pacotes estendidos (em chars HEX)
const EXTENDED_PACKET_LENGTHS = [62];

const EVENT_CODES = {
  // --- ARMES E DESARMES (4XX) ---
  // A tabela não lista explicitamente Arme/Desarme, mas seguem o padrão Contact ID:
  // 401: Arme (Total), 403: Desarme. Vamos manter os que não conflitam.
  '401': 'Arme (Total)',
  '403': 'Desarme',
  '422': 'Acionamento de PGM', // Índice 171

  // --- ALARMES DE EMERGÊNCIA (1XX) ---
  '130': 'Disparo de Zona', // Índice 130
  '131': 'Disparo de Zona 24h', // Índice 131
  '132': 'Disparo de cerca elétrica', // Índice 132
  '134': 'Curto-circuito na Fiação dos Sensores', // Índice 135
  '135': 'Tamper do Sensor', // Índice 136
  '136': 'Problema no dispositivo do barramento', // Índice 137
  '137': 'Tamper/módulo de expansão', // Índice 138
  '138': 'Anulação temporária da zona', // Índice 139
  '139': 'Anulação por disparo', // Índice 140
  '140': 'Falha na rede elétrica', // Índice 141
  '141': 'Bateria principal baixa ou em curto-circuito', // Índice 142
  '142': 'Bateria principal ausente ou invertida', // Índice 143
  '300': 'Sobrecarga na saída auxiliar', // Índice 144
  '302': 'Corte ou curto-circuito na sirene', // Índice 145
  '304': 'Falha na linha telefônica', // Índice 146
  '306': 'Bateria baixa de sensor sem fio', // Índice 147
  '407': 'Desativação remota', // Índice 148
  '409': 'Auto desativação', // Índice 149
  // 100 não está na lista, mas 110/120 sim
  '110': 'Disparo ou pânico de incêndio', // Índice 152
  '111': 'Pânico de coação', // Índice 153
  '120': 'Pânico audível ou silencioso', // Índice 155
  '122': 'Pânico Silencioso', // Índice 154

  // --- FALHAS, TESTES E MUDANÇAS (3XX, 6XX, 8XX) ---
  '305': 'Reset pelo modo de programação', // Índice 156
  '306': 'Alteração da programação do painel', // Índice 157
  '334': 'Falha ao comunicar eventos', // Índice 158
  '461': 'Senha incorreta', // Índice 159
  '410': 'Acesso remoto pelo software de download/ upload', // Índice 160
  '602': 'Teste periódico', // Índice 162
  '603': 'Teste manual', // Índice 161
  '616': 'Solicitação de manutenção', // Índice 164
  '621': 'Reset de buffer de eventos', // Índice 165
  '625': 'Data e hora foram reiniciadas', // Índice 166

  // --- SMART E GPRS/ETH (3XX, 4XX) ---
  '336': 'Falha da supervisão Smart', // Índice 170
  '360': 'Falha no Keep Alive do GPRS', // Índice 174
  '361': 'Falha no Keep Alive da Eth', // Índice 175
  '362': 'Falha rede elétrica módulo expansão', // Índice 176
  '532': 'Inclusão de dispositivo RF', // Índice 177
  '534': 'Inclusão/cadastro de senha', // Índice 178
  '416': 'Atualização do FW com sucesso', // Índice 179
  '417': 'Falha na atualização do FW', // Índice 180
  '535': 'Zona habilitada', // Índice 181
};

// Extrai o ID da central APENAS de pacotes conhecidos
function extractCentralId(hex) {
  // Para pacotes padrão Contact ID (18 chars), ID está POSITIVAMENTE em 6-10
  if (hex.length === 18) {
    return hex.substring(6, 10);
  }

  // --- CORREÇÃO AQUI ---
  // Removemos a lógica do pacote de 62 chars. 
  // Se não é o padrão de 18, retornamos null para não gerar IDs falsos (lixo).
  return null;
}

export function extractCentralIdFromEvent(rawEvent) {
  return extractCentralId(rawEvent);
}

export function decodeAmtEvent(rawEvent) {
  if (rawEvent.length !== 18) {
    throw new Error(`Pacote de tamanho inválido (${rawEvent.length} chars).`);
  }

  const header = rawEvent.substring(0, 4);
  const channel = rawEvent.substring(4, 6);
  // Aqui usamos o helper seguro
  const account = extractCentralId(rawEvent) || 'UNKNOWN';
  const macPayload = rawEvent.substring(10, 16);
  const checksum = rawEvent.substring(16, 18);

  const potentialEventCode = macPayload.substring(0, 3);
  const contactIdCode = EVENT_CODES[potentialEventCode] ? potentialEventCode : 'DESCONHECIDO';
  const eventDescription = EVENT_CODES[contactIdCode] || `Cód. ${contactIdCode} (Consultar Tabela Contact ID)`;

  const potentialZoneHex = macPayload.substring(2, 4);
  const zone = parseInt(potentialZoneHex, 16).toString().padStart(2, '0');

  return {
    account,
    channel,
    code: contactIdCode,
    type: eventDescription,
    zone,
    mac_payload: macPayload,
    header,
    checksum
  };
}

export function findAndDecodeEvents(rawEventHex) {
  const EVENT_LENGTH = 18;
  const decodedEvents = [];
  let shouldSendAck = false;

  // Inicializamos como NULL. Só mudaremos se tivermos certeza absoluta do ID.
  let centralId = null;

  let processedHex = rawEventHex.replace(/[^0-9a-fA-F]/g, '').toLowerCase();

  // 1. Keep-Alive (f7)
  if (processedHex === 'f7') {
    console.log('[PARSER] Sinal de Keep-Alive (f7) detectado.');
    shouldSendAck = true;
    return { decodedEvents, shouldSendAck, centralId: null };
  }

  // 2. Pacote Estendido (62 chars)
  if (EXTENDED_PACKET_LENGTHS.includes(processedHex.length)) {
    console.log(`[PARSER] Pacote estendido de tamanho ${processedHex.length} detectado. ACK necessário.`);
    shouldSendAck = true;

    // NÃO tentamos extrair ID aqui. Deixamos centralId como NULL.
    // O servidor manterá o ID antigo (ex: 5001) associado ao socket.

    decodedEvents.push({
      type: 'Pacote Estendido HEX',
      length: processedHex.length,
      raw: processedHex,
      account: 'Preservado', // Apenas string visual
      zone: 'N/A'
    });

    return { decodedEvents, shouldSendAck, centralId: null };
  }

  // 3. Eventos Contact ID (18 chars)
  let tempHex = processedHex;
  while (tempHex.length >= EVENT_LENGTH) {
    let eventFound = false;
    for (let i = 0; i <= tempHex.length - EVENT_LENGTH; i++) {
      const potentialEvent = tempHex.substring(i, i + EVENT_LENGTH);
      try {
        const decodedEvent = decodeAmtEvent(potentialEvent);
        decodedEvents.push(decodedEvent);

        // AQUI é seguro pegar o ID, pois sabemos o formato Contact ID
        if (!centralId) centralId = decodedEvent.account;

        shouldSendAck = true;
        eventFound = true;

        if (i > 0) {
          console.warn(`[PARSER] Lixo ignorado antes do evento: ${tempHex.substring(0, i)}`);
        }
        tempHex = tempHex.substring(i + EVENT_LENGTH);
        break;
      } catch (e) {
        // Ignora falhas
      }
    }
    if (!eventFound) break;
  }

  if (tempHex.length > 0 && tempHex !== 'f7') {
    console.warn(`[PARSER] Resíduo final ignorado: ${tempHex}`);
  }

  return { decodedEvents, shouldSendAck, centralId };
}