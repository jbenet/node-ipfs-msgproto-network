var test = require('tape')
var map = require('lodash.map')
var bufeq = require('buffer-equal')
var multiDgrams = require('multi-dgram-stream')
var msgproto = require('msgproto')
var mpNetwork = require('./')

function setupEndpointStreams(addrs) {
  addrs = map(addrs, function(a) {
    return 'localhost:' + a
  })

  return map(addrs, function (addr) {
    var source = new Buffer("" + addr)
    var wire = multiDgrams(addr, addrs)
    wire = msgproto.WireProtocol(mpNetwork.Frame, wire)
    wire = mpNetwork.EndpointProtocol(wire, {
      payloadType: Buffer,
      source: source,
    })
    wire.source = source
    return wire
  })
}


test('test endpoint', function(t) {
  var numMessages = 10
  t.plan((numMessages * (4 * 3 + 1)) + 1)

  var sent = {}
  function received(payload, s) {
    sent[payload]._received++
    if (sent[payload]._received == streams.length) { // all got it.
      delete sent[payload]
      t.ok(!sent[payload], 'should be done with msg: ' + payload)
    }

    if (Object.keys(sent).length == 0) { // all done
      map(streams, function(s) {
        s.write(null)
        s.middle.end() // why doesn't s.end() work!?
      })
      t.ok(true, 'should be done')
    }
  }

  var streams = setupEndpointStreams([1234, 2345, 3456])
  map(streams, function(s) {
    function check(msg1, msg2) {
      t.ok(msg2, 'should have sent msg: ' + msg1.payload)
      t.ok(bufeq(msg1.destination, msg2.destination), 'destinations should match')
      t.ok(bufeq(msg1.source, msg2.source), 'sources should match')
    }

    s.on('data', function(msg) {
      check(msg, sent[msg.payload])
      t.ok(bufeq(msg.destination, s.source), 'destination should match stream source')
      received(msg.payload, s)
    })

    s.incoming.on('filtered-incoming', function(msg) {
      check(msg, sent[msg.payload])
      t.notOk(bufeq(msg.destination, s.source), 'destination should NOT match stream source')
      received(msg.payload, s)
    })

    s.incoming.on('net-error', console.log)
    s.outgoing.on('net-error', console.log)
  })

  for (var i = 0; i < numMessages; i++) {
    var payload = new Buffer('hello there #' + i)
    var sender = streams[(i + 1) % streams.length]
    var receiver = streams[(i + 2) % streams.length]
    var msg = mpNetwork.Frame(sender.source, receiver.source, payload)
    msg._received = 0
    sent[payload] = msg
    sender.send(receiver.source, payload)
    console.log('sent: ' + payload)
  }
})
