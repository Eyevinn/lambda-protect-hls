require('dotenv').config();

const fastify = require("fastify");
const { handler } = require("./dist/index.js");

const server = fastify();
server.get("*", async (request, reply) => {
  let params = {};
  if (request.query) {
    Object.keys(request.query).map(k => {
      params[k] = request.query[k];
    });
  }
  const [ path, rest ] = request.url.split("?");
  const event = {
    path: path,
    httpMethod: request.method,
    headers: request.headers,
    queryStringParameters: params,
  };
  const response = await handler(event);
  reply
  .code(response.statusCode)
  .headers(response.headers)
  .send(response.body);
});

server.listen(process.env.PORT || 8000, "0.0.0.0", (err, address) => {
  console.log(`Server listening at ${address}`);
});