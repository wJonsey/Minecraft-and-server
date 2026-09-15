const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const WebSocket = require('ws')
const { createGameServer, server } = require('./server')

const waitFor = (socket, predicate) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket message')), 2000)
  const onMessage = (raw) => {
    const message = JSON.parse(raw)
    if (!predicate(message)) return
    clearTimeout(timer)
    socket.off('message', onMessage)
    resolve(message)
  }
  socket.on('message', onMessage)
})

test('WebSocket multiplayer syncs players, edits, chat, and disconnects', async (t) => {
  const wsServer = createGameServer(server)
  await new Promise(resolve => server.listen(0, resolve))
  const { port } = server.address()
  t.after(async () => {
    wsServer.close()
    await new Promise(resolve => server.close(resolve))
  })

  const first = new WebSocket(`ws://127.0.0.1:${port}`)
  const firstWelcomePromise = waitFor(first, message => message.type === 'welcome')
  await new Promise(resolve => first.once('open', resolve))
  const firstWelcome = await firstWelcomePromise
  assert.equal(firstWelcome.players.length, 0)

  const second = new WebSocket(`ws://127.0.0.1:${port}`)
  const secondWelcomePromise = waitFor(second, message => message.type === 'welcome')
  const playerJoinPromise = waitFor(first, message => message.type === 'playerJoin')
  t.after(() => second.close())
  await new Promise(resolve => second.once('open', resolve))
  const secondWelcome = await secondWelcomePromise
  assert.equal(secondWelcome.players[0].id, firstWelcome.id)
  assert.equal((await playerJoinPromise).player.id, secondWelcome.id)

  const movePromise = waitFor(first, message => message.type === 'playerMove')
  second.send(JSON.stringify({ type: 'move', x: 12, y: 76, z: 9, yaw: 1, pitch: 0, flying: false }))
  assert.deepEqual(await movePromise, {
    type: 'playerMove', id: secondWelcome.id, x: 12, y: 76, z: 9, yaw: 1, pitch: 0, flying: false,
  })

  const blockPromise = waitFor(second, message => message.type === 'blockChange')
  first.send(JSON.stringify({ type: 'blockChange', x: 2, y: 70, z: -3, id: 5 }))
  assert.deepEqual(await blockPromise, {
    type: 'blockChange', x: 2, y: 70, z: -3, id: 5,
  })

  const secondChatPromise = waitFor(second, message => message.type === 'chat')
  const firstChatPromise = waitFor(first, message => message.type === 'chat')
  first.send(JSON.stringify({ type: 'chat', text: '<b>hello</b>' }))
  const chat = await secondChatPromise
  assert.equal(chat.text, '<b>hello</b>')
  assert.equal((await firstChatPromise).text, '<b>hello</b>')

  const leavePromise = waitFor(first, message => message.type === 'playerLeave')
  second.close()
  assert.equal((await leavePromise).id, secondWelcome.id)
  first.close()
})
