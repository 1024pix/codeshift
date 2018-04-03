server.inject({
  url: '/api/blah',
  method: 'POST',
  payload: {
    name: 'Example Blah'
  }
}, (output) => {
  code.expect(output.statusCode).to.equal(200);
  code.expect(output.statusMessage).to.equal('ok');
  server.inject({
    url: '/api/argle',
    method: 'POST',
    payload: {
      url: 'example.com',
      name: 'Example Argle'
    }
  }, (output2) => {
    code.expect(output2.statusCode).to.equal(400);
    code.expect(output2.statusMessage).to.equal('just no');
    server.inject({
      url: '/api/argle',
      method: 'POST',
      payload: {
        url: 'example.com',
        name: 'Example Argle'
      }
    }, (output3) => {
      code.expect(output3.statusCode).to.equal(400);
      code.expect(output3.statusMessage).to.equal('just no');
      done();
    });
  });
});
