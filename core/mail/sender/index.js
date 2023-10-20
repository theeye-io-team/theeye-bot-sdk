
const nodemailer = require('nodemailer')
const debug = require('debug')('email:smtp')
const config = require('../../config').decrypt()
const path = require('path')

const main = module.exports = async ([ subject, to, html, files ]) => {
  if (!Array.isArray(files)) {
    files = [ files ]
  }

  const attachments = []
  for (let index = 0; index < files.length; index++) {
    attachments.push({
      filename: path.basename(files[index]),
      path: files[index]
    })
  }

  const email = {
    from: config.sender.from,
    to,
    subject,
    html,
    attachments
  }

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
  main([
    process.argv[2], // subject
    process.argv[3], // to
    process.argv[4], // html
    process.argv[5], // attachment path
  ]).then(console.log).catch(console.error)
}
