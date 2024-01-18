
const nodemailer = require('nodemailer')
const debug = require('debug')('email:smtp')
const config = require('../../config').decrypt()
const path = require('path')

const main = module.exports = async ({ subject, to, html, text, files, cc }) => {
  const attachments = []
  if (files) {
    if (!Array.isArray(files)) {
      files = [ files ]
    }

    for (let index = 0; index < files.length; index++) {
      attachments.push({
        filename: path.basename(files[index]),
        path: files[index]
      })
    }
  }

  const email = {
    from: config.sender.from,
    to,
    subject,
    attachments
  }
  if (text) { email.text = text }
  if (html) { email.html = html }
  if (cc) { email.cc = cc }

  debug(email)
  await sendEmail(email)
}

const sendEmail = (email) => {
  return new Promise((resolve, reject) => {
    const transport = nodemailer.createTransport(config.sender.transport)
    transport.sendMail(email, (err, info) => {
      if (err) {
        debug(err)
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

if (require.main === module) {
  main({
    subject: process.argv[2], // subject
    to: process.argv[3], // to
    html: process.argv[4], // html
    files: [ process.argv[5] ], // attachment path
  }).then(console.log).catch(console.error)
}
