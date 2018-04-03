const res = await server.db.projects.find({ slug: 'example' });
code.expect(err).to.equal(null);
const res2 = await server.db.projects.find({ slug: 'example-2' });
code.expect(err2).to.equal(null);
res2.toArray().then((array) => {
  code.expect(array.length).to.equal(3);
  done();
});
res.toArray().then((array) => {
  code.expect(array.length).to.equal(1);
  done();
});
