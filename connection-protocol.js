var transDuplex = require('duplex-transform')
var msgproto = require('msgproto')
var extend = require('xtend')
var bufeq = require('buffer-equal')
var NetworkFrame = require('./frame')
var err = require('./errors')

module.exports = ConnectionProtocol


// connection-protocol wraps a duplex packet stream
// with source and destination address population.
// - wraps + unwraps network packets)
// - abstracts away the network in a per (source, dest) stream.

function ConnectionProtocol(stream, opts) {
  opts = extend(ConnectionProtocol.defaults, opts || {})

  if (!opts.source || !(opts.source instanceof Buffer))
    throw new Error('requires opts.source (Buffer)')

  if (!opts.destination || !(opts.destination instanceof Buffer))
    throw new Error('requires opts.destination (Buffer)')

  if (!opts.payloadType)
    throw new Error('requires opts.payloadType')

  return transDuplex.obj(outgoing, stream, incoming)

  // filter if msg src + dst dont match
  function filter(msg, src, dst) {
    return !bufeq(msg.source, src) ||
           !bufeq(msg.destination, dst)
  }

  function outgoing(msg, enc, next) {
    if (opts.wrap) {
      msg = NetworkFrame(opts.source, opts.destination, msg, opts.payloadType)
    }
    else if (filter(msg, opts.source, opts.destination)) {
      this.emit('filtered-outgoing', msg)
      return next()
    }

    this.push(msg)
    next()
  }

  function incoming(msg, enc, next) {

    // should filter?
    if (filter(msg, opts.destination, opts.source)) {
      this.emit('filtered-incoming', msg)
      return next()
    }

    if (opts.unwrap) {
      msg = msg.getDecodedPayload()
    }

    // ok seems legit
    this.push(msg)
    next()
  }
}

ConnectionProtocol.defaults = {
  wrap: true,
  unwrap: true,
}
