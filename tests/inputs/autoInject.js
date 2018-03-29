async.autoInject({
  server(done) {
    setup({}, done);
  },
  db1(server, done) {
    server.db.entity.insert({
      name: 'david',
      users: ['1234', '5678']
    }, done);
  },
  db2(db1, server, done) {
    if (itIsTrue) {
      server.db.entity.insert({
        name: 'david',
        users: ['1234', '5678']
      }, done);
    }
  },
  name(db1, done) {
    return done(null, db1.name);
  },
  error(name, done) {
    if (name === 'david') {
      return done(new Error('something bad'));
    }
    return done();
  }
}, (err, results) => {
  if (err) {
    return allDone(err);
  }
  server = results.server;
  const name = results.name;
});
