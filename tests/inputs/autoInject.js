async.autoInject({
  server(done) {
    setup({}, done);
  },
  simpleAwaitExpression(server, done) {
    server.db.entity.insert({
      name: 'david',
      users: ['1234', '5678']
    }, done);
  },
  complexAwaitExpression(simpleAwaitExpression, server, done) {
    if (itIsTrue) {
      server.db.entity.insert({
        name: 'gloria',
        users: ['1234', '5678']
      }, done);
    } else {
      server.db.entity.insert({
        name: 'rico',
        users: ['1234', '5678']
      }, done);
    }
  },
  noResult(done) {
    done();
  },
  result(simpleAwaitExpression, done) {
    return done(null, simpleAwaitExpression.name);
  },
  error(result, done) {
    if (result === 'david') {
      return done(new Error('something bad'));
    }
    return done();
  }
}, (err, results) => {
  if (err) {
    return allDone(err);
  }
  doSomething(results);
  server = results.server;
  const name = results.name;
});
