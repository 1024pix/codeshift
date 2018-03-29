const server = await setup({});;
const db1 = await server.db.entity.insert({
  name: 'david',
  users: ['1234', '5678']
});;
const name = db1.name;
if (name === 'david') {
  throw new Error('something bad');
}
