const output = await server.inject({
  url: '/api/blah',
  method: 'POST',
  payload: {
    name: 'Example Blah'
  }
});
code.expect(output.statusCode).to.equal(200);
const output2 = await server.inject({
  url: '/api/argle',
  method: 'POST',
  payload: {
    url: 'example.com',
    name: 'Example Argle'
  }
});
code.expect(output2.statusCode).to.equal(400);
done();
