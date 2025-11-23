# Intelbras Integração Node.js

Este projeto é uma aplicação Node.js para integração com centrais de alarme Intelbras, permitindo armar, desarmar e consultar a versão do firmware via comandos TCP. Utiliza Express para rotas HTTP e um servidor TCP para eventos e monitoramento.

## Estrutura do Projeto

```
intelbras-integracao-nodejs
├── src/
│   ├── index.js                # Inicialização da API Express e servidor TCP
│   ├── serversocket.js         # Servidor TCP para eventos das centrais
│   ├── routes.js               # Configuração das rotas de comando
│   ├── command/
│   │   ├── arm.js              # Handler para comando de armar
│   │   ├── disarm.js           # Handler para comando de desarmar
│   │   └── firmware.js         # Handler para consulta de firmware
│   ├── utils/
│   │   ├── activeSocket.js     # Gerenciamento dos sockets ativos das centrais
│   │   ├── checksum.js         # Funções de conversão e cálculo de checksum
│   │   ├── protocol.js         # Envio de comandos via socket existente
│   │   ├── event.js            # Decodificação de eventos Contact ID e pacotes estendidos
│   │   └── sendTcpCommand.js   # Envio de comandos via novo cliente TCP
├── package.json                # Configuração do npm
└── README.md                   # Documentação do projeto
```

## Instalação

1. Clone o repositório:
```bash
git clone <URL_DO_REPOSITORIO>
```
2. Acesse o diretório do projeto:
```bash
cd intelbras-integracao-nodejs
```
3. Instale as dependências:
```bash
npm install
```

## Uso

Para iniciar o servidor:
```bash
npm start
```
- API HTTP disponível em: `http://localhost:3000`
- Servidor TCP para eventos: porta `7000`

## Endpoints

- **Armar**:  
`GET /api/command/arm/:centralId/:partition/:user`
Exemplo: `/api/command/arm/5001/1/1234`

- **Desarmar**:  
`GET /api/command/disarm/:centralId/:partition/:user`
Exemplo: `/api/command/disarm/5001/1/1234`

- **Firmware**:  
`GET /api/command/firmware/:centralId`
Exemplo: `/api/command/firmware/5001`

> **Nota:** O parâmetro `centralId` corresponde ao ID da central que está conectada ao servidor TCP.

## Funcionamento

- O servidor TCP recebe eventos das centrais e associa cada conexão ao seu respectivo `centralId`.
- Os comandos de armar, desarmar e consulta de firmware são enviados diretamente pelo socket já estabelecido, garantindo compatibilidade com redes CGNAT.
- O gerenciamento dos sockets ativos é feito pelo arquivo `activeSocket.js`.

## Contribuição

Contribuições são bem-vindas!
Abra issues ou pull requests para sugestões e melhorias.

## Licença

Este projeto está licenciado sob a MIT License.