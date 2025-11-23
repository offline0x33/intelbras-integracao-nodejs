// utils/event.js

// Tamanhos de pacotes estendidos (em chars HEX)
const EXTENDED_PACKET_LENGTHS = [62];

const EVENT_CODES = {
  // --- ALARMES DE EMERGÊNCIA (Base 1XX) ---
  '121': 'Alarme de Fogo', // [5]
  '130': 'Alarme de Pânico (Silencioso)', // Subcomando 0x00 do Pânico [5]
  '131': 'Pânico Audível (Emergência Pessoal)', // Inferido do Subcomando 0x01 do Pânico [5]
  '100': 'Emergência Médica', // Inferido do Subcomando 0x02 do Pânico [5]
  '134': 'Alarme de Sabotagem (Tamper)', // [6], [7], [8]
  '137': 'Alarme de Zona de Detecção',

  // --- FALHAS E RESTAUROS DE SISTEMA (Base 3XX) ---
  '300': 'Falha de Energia AC (Perda de Rede)', // Corresponde ao Byte 1, bit do Status de Problemas [4]
  '301': 'Restauro de Energia AC', // Original da lista
  '302': 'Restauro de Bateria', // Original da lista
  '303': 'Falha de Bateria (Bateria Baixa)', // Corresponde ao Byte 1, bit[9] do Status de Problemas [4]

  // --- FALHAS DE COMUNICAÇÃO / PERIFÉRICOS ---
  '204': 'Falha de Supervisão de Teclado (Exemplo 20X)', // [10]
  '305': 'Falha de Supervisão de Sirene (Exemplo 30X)', // [10]
  '351': 'Falha/Corte de Linha Telefônica', // Corresponde ao Byte 5, bit[11] do Status de Problemas [12]
  '355': 'Falha ao Comunicar Evento', // Corresponde ao Byte 5, bit[13] do Status de Problemas [12]
  '337': 'Restauro de Zona de Detecção',

  // --- ARME/DESARME E COMANDOS (Base 4XX) ---
  '401': 'Arme (Total)',
  '403': 'Desarme',
  '407': 'Arme Parcial (Modo Noturno)', // Para cobrir a opção "Modo noturno" do Comando 0x16 [14]
  '422': 'Acionamento de PGM', // Código permitido para eventos [15]
  '461': 'Evento de Alarme (Exemplo de Transmissão)', // Código de exemplo em transações 0xB0 [1]

  // --- TESTES (Base 6XX e 8XX) ---
  '602': 'Teste Periódico',
  '840': 'Teste Manual / Status Periódico',

  // --- EVENTOS ESPECÍFICOS DE PROBLEMAS ---
  '320': 'Falha de Sirene (Corte/Curto-circuito)', // Corresponde ao Status Byte 5, bits  e [9] [12], [16]
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