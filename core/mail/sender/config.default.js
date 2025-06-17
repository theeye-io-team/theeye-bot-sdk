
module.exports = {
  sender: {
    from: 'NO REPLY <support@theeye.io>',
    transport: {
      host: 'smtp.gmail.com',
      port: '587',
      auth: {
        user: '',
        pass: '',
      },
      secureConnection: false,
      tls: {
        ciphers: 'SSLv3'
      },
      requireTLS: true
    }
  }
}
