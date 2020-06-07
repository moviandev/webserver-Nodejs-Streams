const net = require('net');
const server = net.createServer();
server.on('connection', handleConnection);
server.listen(3000);

// function handleConnection(socket) {
//   socket.on('data', (chunk) => {
//     console.log(`Received chunk:\n`, chunk.toString());
//   });
//   socket.write(
//     'HTTP/1.1 200 OK\r\nServer: my-web-server\r\nContent-Length: 0\r\n\r\n'
//   );
// }

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
      console.log(`Request header:\n${reqHeader}`);

      // Nesse ponto paramos de ler do socket e temos o cabeçalho como uma string
      // Se quisermos ler todo o corpo da requisição podemos fazer o seguinte:
      reqBuffer = new Buffer.from('');
      while ((buf = socket.read()) !== null) {
        reqBuffer = Buffer.concat([reqBuffer, buf]);
      }
      let reqBody = reqBuffer.toString();
      console.log(`Request Body:\n${reqBody}`);

      // Enviar um resposta generica
      socket.end(
        'HTTP/1.1 200 OK\r\nServer: my-custom-server\r\nContent-Length: 0\r\n\r\n'
      );
    }
  });
}
