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

      /* Negocio relacionado a resposta */
      // Valores iniciais
      let status = 200,
        statusText = 'OK',
        headersSent = false,
        isChunked = false;
      const responseHeaders = {
        server: 'my-custom-server',
      };

      function setHeader(key, value) {
        responseHeaders[key.toLowerCase()] = value;
      }

      function sendHeaders() {
        // Faça isso apenas uma única vez.
        if (!headersSent) {
          headersSent = true;

          // Adicionar a data ao cabeçalho
          setHeader('date', new Date().toGMTString());

          // Enviar a linha de status
          socket.write(`HTTP/1.1 ${status} ${statusText}\r\n`);

          // A seguir enviar cada cabeçalho
          Object.keys(responseHeaders).forEach((headerKey) => {
            socket.write(`${headerKey}: ${responseHeaders[headerKey]}\r\n`);
          });

          // Adicionar ao final \r\n para demilitar o cabeçalho de resposta do corpo
          socket.write('\r\n');
        }
      }

      const response = {
        write(chunk) {
          if (!headersSent) {
            // Se não tiver tiver nenhum cabeçalho "tamanho de conteúdo" content-length, então especificar a "Codificação de Transferência" Transfer-Encodgin como chunked
            if (!responseHeaders['content-length']) {
              isChunked = true;
              setHeader('transfer-encoding', 'chunked');
            }
            sendHeaders();
          }
          if (isCHunked) {
            const size = chunk.length.toString(16);
            socket.write(`${size}\r\n`);
            socket.write(chunk);
            socket.write('\r\n');
          } else {
            socket.write(chunk);
          }
        },
        end(chunk) {
          if (!headersSent) {
            // Nós sabemos o tamanho completo da resposta, vamos configurar
            if (!responseHeaders['content-length']) {
              // Assumimos que o "pedaço" chunk é um Buffer, não uma string
              setHeader('content-length', chunk ? chunk.length : 0);
            }
            sendHeaders();
          }

          if (isChunked) {
            if (chunk) {
              const size = chunk.length.toString(16);
              socket.write(`${size}\r\n`);
              socket.write(chunk);
              socket.write('\r\n');
            }
            socket.end('0\r\n');
          } else {
            socket.end(chunk);
          }
        },
        setHeader,
        setStatus(newStatus, newStatusText) {
          (status = newStatus), (statusText = newStatusText);
        },
        // ENviar um json pelo servidor
        json(data) {
          if (headerSent)
            throw new Error('Headers sent, cannot proceed to send JSON');

          const json = new Buffer.from(JSON.stringify(data));
          setHeader('content-type', 'application/json; charset=utf-8');
          setHeader('content-length', json.length);
          sendHeaders();
          socket.end(json);
        },
      };

      // Enviar a requisição para o handler
      requestHandler(request, response);
    });
  }

  return {
    listen: (port) => server.listen(port),
  };
}

const webServer = createWebServer((req, res) => {
  // The original code from hello-world file ;)
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

webServer.listen(3000);
