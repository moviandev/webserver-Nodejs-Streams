const net = require('net');

function createWebServer(requestHandler) {
  const server = net.createServer();
  server.on('connection', handleConnection);

  function handleConnection(socket) {
    // Única inscrição no metodo readable para então chamarmos o .read()
    socket.once('readable', () => {
      // Configurando um buffer para guardar os dados que estão chegando
      let reqBuffer = new Buffer.from('');

      // Configurar um buffer temporario para ler os dados dos pedaços que estão chegando
      let buf;
      let reqHeader;
      while (true) {
        // Lendo dados vindos do socket
        buf = socket.read();
        // Caso null ou undefined parar
        if (buf == null) break;

        // Concatenar request buffer já existente com os novos dados
        reqBuffer = Buffer.concat([reqBuffer, buf]);

        // Verificar se chegamos \r\n\r\n, indicador de final de cabeçalho
        let marker = reqBuffer.indexOf('\r\n\r\n');
        if (marker !== -1) {
          // Se chegamos em \r\n\r\n podemos ter mais dados depois disso, guarde essa informação
          let remaining = reqBuffer.slice(marker + 4);

          // O cabeçalho foi tudo que lemos até agora sem incluir \r\n\r\n
          reqHeader = reqBuffer.slice(0, marker).toString();

          // Essa parte coloca os dados extras que lemos de volta ao stream legível do socket
          socket.unshift(remaining);
          break;
        }
      }

      /* Negocio relacionado a requisição */
      // Começo do parseamento do cabeçalho
      const reqHeaders = reqHeader.split('\r\n');

      // A primeira linha é especial
      const reqLine = reqHeaders.shift().split(' ');

      // As próximas linhas são um cabeçalho por linha, montaremos um objeto a partir disso
      const headers = reqHeaders.reduce((acc, currentHeader) => {
        const [key, value] = currentHeader.split(':');
        return {
          ...acc,
          [key.trim().toLowerCase()]: value.trim(),
        };
      }, {});

      // Esse objeto será enviado para a callback handleRequest
      const request = {
        method: reqLine[0],
        url: reqLine[1],
        httpVersion: reqLine[2].split('/')[1],
        headers,
        // O usuário desse servidor de internet pode ler diretamente do socket para pegar o corpo da requisição
        socket,
      };
    });
  }
}
