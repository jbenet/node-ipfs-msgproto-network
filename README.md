# ifps-msgproto-network

[msgproto](http://github.com/jbenet/node-ipfs-msgproto) network frame. Adds network endpoint addresses to messages.

- `EndpointProtocol` filters messages based on a single endpoint address.
- `ConnectionProtocol` filters messages based on (src, dst) address pair.
- `SwitchProtocol` switches messages to multiple interfaces based on a forwarding table. (TODO)
