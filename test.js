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
      t.ok(bufeq(msg.destination, s.opts.source), 'destination should match stream source')
      received(msg.payload, s)
    })

    s.incoming.on('filtered-incoming', function(msg) {
      check(msg, sent[msg.payload])
      t.notOk(bufeq(msg.destination, s.opts.source), 'destination should NOT match stream source')
      received(msg.payload, s)
    })

    s.incoming.on('net-error', console.log)
    s.outgoing.on('net-error', console.log)
  })

  for (var i = 0; i < numMessages; i++) {
    var payload = new Buffer('hello there #' + i)
    var sender = streams[(i + 1) % streams.length]
    var receiver = streams[(i + 2) % streams.length]
    var msg = mpNetwork.Frame(sender.opts.source, receiver.opts.source, payload)
    msg._received = 0
    sent[payload] = msg
    sender.send(receiver.opts.source, payload)
    console.log('sent: ' + payload)
  }
})


function setupConnectionStreams(addrs) {
  addrs = map(addrs, function(a) {
    return 'localhost:' + a
  })

  return map(addrs, function (addr) {
    var wire = multiDgrams(addr, addrs)
    wire = msgproto.WireProtocol(mpNetwork.Frame, wire)
    return map(addrs, function (addr2) {
      return mpNetwork.ConnectionProtocol(wire, {
        unwrap: false,
        source: new Buffer("" + addr),
        destination: new Buffer("" + addr2),
      })
    })
  })
}


test('test connection', function(t) {
  var numMessages = 10
  t.plan((numMessages * (9 + 1)) + 1)

  var sent = {}
  function received(payload) {
    sent[payload]++
    if (sent[payload] == streams.length * streams.length) { // all got it.
      delete sent[payload]
      t.ok(!sent[payload], 'should be done with msg: ' + payload)
    }

    if (Object.keys(sent).length == 0) { // all done
      map(streams, function(set) {
        map(set, function(s) {
          s.write(null)
          s.middle.end() // why doesn't s.end() work!?
        })
      })
      t.ok(true, 'should be done')
    }
  }

  var streams = setupConnectionStreams([1234, 2345, 3456])
  map(streams, function(set) {
    map(set, function(conn) {
      conn.on('data', function(msg) {
        var eq = bufeq(msg.source, conn.opts.destination) &&
                 bufeq(msg.destination, conn.opts.source)
        t.ok(eq, 'addresses should match conn')
        received(msg.payload)
      })

      conn.incoming.on('filtered-incoming', function(msg) {
        var eq = bufeq(msg.source, conn.opts.destination) &&
                 bufeq(msg.destination, conn.opts.source)
        t.notOk(eq, 'addresses should NOT match conn')
        received(msg.payload, conn)
      })

      conn.incoming.on('net-error', console.log)
      conn.outgoing.on('net-error', console.log)
    })
  })

  for (var i = 0; i < numMessages; i++) {
    var payload = new Buffer('hello there #' + i)
    var conn = streams[(i + 1) % streams.length][(i + 2) % streams.length]
    sent[payload] = 0
    conn.write(payload)
    console.log('sent: ' + payload)
  }
})
