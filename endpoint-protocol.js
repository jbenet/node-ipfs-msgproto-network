var transDuplex = require('duplex-transform')
var msgproto = require('msgproto')
var extend = require('xtend')
var bufeq = require('buffer-equal')
var NetworkFrame = require('./frame')
var err = require('./errors')

module.exports = EndpointProtocol


// endpoint-protocol wraps a duplex packet stream
// with address checks/filter:
// - outgoing source must match addr
// - incoming destination must match addr

function EndpointProtocol(stream, opts) {
  opts = extend(EndpointProtocol.defaults, opts || {})
  if (!opts.source || !(opts.source instanceof Buffer))
    throw new Error('requires opts.source (Buffer)')

  var stream = transDuplex.obj(outgoing, stream, incoming)
  stream.opts = opts
  stream.send = send // patch in send helper
  return stream

  // crafts a network message, and writes it.
  function send(dest, msg, payloadType) {
    if (!(dest instanceof Buffer))
      throw new Error('dest must be a Buffer')

    payloadType = payloadType || opts.payloadType

    msg = NetworkFrame(opts.source, dest, msg, payloadType)
    this.write(msg)
  }

  function outgoing(msg, enc, next) {

    // if not NetFrame, bail
    if (!(msg instanceof NetworkFrame)) {
      this.emit('net-error', {error: err.NotNetFrameErr, message: msg})
      return next()
    }

    // if no destination, bail
    if (!msg.destination) {
      this.emit('net-error', {error: err.DestinationErr, message: msg})
      return next()
    }

    // patch in source if there isn't one.
    if (opts.defaultSource && !msg.source) {
      msg.source = new Buffer(opts.source) // copy
    }

    // if filtering, check addrs
    if (opts.filterOutgoing && !bufeq(msg.source, opts.source)) {
      this.emit('filtered-outgoing', msg)
      return next()
    }

    // ok seems legit
    this.push(msg)
    next()
  }

  function incoming(msg, enc, next) {

    // if not NetFrame, bail
    if (!(msg instanceof NetworkFrame)) {
      this.emit('net-error', {error: err.NotNetFrameErr, message: msg})
      return next()
    }

    // if no source (other), bail
    if (!msg.source) {
      this.emit('net-error', {error: err.SourceErr, message: msg})
      return next()
    }

    // if no destination (this), bail
    if (!msg.destination) {
      this.emit('net-error', {error: err.SourceErr, message: msg})
      return next()
    }

    // if filtering, check addrs
    if (opts.filterIncoming && !bufeq(msg.destination, opts.source)) {
      this.emit('filtered-incoming', msg)
      return next()
    }

    // ok seems legit
    this.push(msg)
    next()
  }
}

EndpointProtocol.defaults = {
  defaultSource: true,
  filterOutgoing: true,
  filterIncoming: true,
}
