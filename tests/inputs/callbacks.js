server.db.projects.find({ slug: 'example' }, (err, res) => {
  code.expect(err).to.equal(null);
  server.db.projects.find({ slug: 'example-2' }, (err2, res2) => {
    code.expect(err2).to.equal(null);
    res2.toArray().then((array) => {
      code.expect(array.length).to.equal(3);
      done();
    });
  });
  res.toArray().then((array) => {
    code.expect(array.length).to.equal(1);
    done();
  });
});
