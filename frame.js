var fs = require('fs')
var msgproto = require('msgproto')
var Frame = msgproto.Frame

module.exports = NetworkFrame

function NetworkFrame(src, dst, payload, payloadType) {
  if (!(this instanceof NetworkFrame))
    return new NetworkFrame(src, dst, payload, payloadType)

  Frame.call(this, payload, payloadType)
  this.source = src
  this.destination = dst
}

msgproto.Message.inherits(NetworkFrame, Frame)

NetworkFrame.prototype.toString = function() {
  var from = this.source.toString('hex').substr(0, 6)
  var to = this.destination.toString('hex').substr(0, 6)
  return "<NetworkFrame "+from+" -> "+to+">"
}

NetworkFrame.prototype.validate = function() {
  var err = Frame.prototype.validate.apply(this)
  if (err) return err

  if (!this.source || !(this.source instanceof Buffer))
    return new Error("no or invalid source")

  if (!this.destination || !(this.destination instanceof Buffer))
    return new Error("no or invalid destination")
}

NetworkFrame.prototype.getEncodedData = function() {
  var data = Frame.prototype.getEncodedData.apply(this)
  data.source = this.source
  data.destination = this.destination
  return data
}

NetworkFrame.prototype.setDecodedData = function(data) {
  Frame.prototype.setDecodedData.apply(this, arguments)
  this.source = data.source
  this.destination = data.destination
}

var src = fs.readFileSync(__dirname + '/network.proto', 'utf-8')
var protos = msgproto.ProtobufCodec.fromProtoSrc(src)
NetworkFrame.codec = protos.NetworkFrame
