const ImapMailbot = require('./imap')
const MsGraphMailbot = require('./msgraph')

module.exports = function (config) {
  if (config.imap) {
    return new ImapMailbot(config)
  }
  if (config.msGraph) {
    return new MsGraphMailbot(config)
  }
  throw new Error('Invalid mail client configuration')
}