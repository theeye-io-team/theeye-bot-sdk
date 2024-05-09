const { ImapFlow } = require('imapflow')
const { DateTime } = require('luxon')
//const rfc2047 = require('rfc2047')
const path = require('path')
const got = require('got')
const { simpleParser } = require('mailparser')
const tnef = require('node-tnef')
const mime = require('mime-types')
const crypto = require('crypto')

const logger = require('../../logger')('mailbot')
const EscapedRegExp = require('../../escaped-regexp')

const IGNORE_MESSAGES_TIMEZONE = false
const USE_SERVER_RECEIVED_DATE = false
const TIMEZONE = 'America/Argentina/Buenos_Aires'

const msxoauth2token = require('./msxoauth2token')

class MailBot {
  constructor (config) {
    this.config = config
  }

  async connect (folder = null) {
    const imapConfig = this.config.imap

    const pass = (imapConfig.password || imapConfig.auth?.pass)
    const user = (imapConfig.user || imapConfig.auth?.user)
    let accessToken = (imapConfig.accessToken || imapConfig.auth?.accessToken)

    const config = {
      logger: (imapConfig.debug===true?logger:noopLogger),
      emitLogs: (imapConfig.emitLogs || false),
      host: imapConfig.host,
      port: (imapConfig.port || 993),
      secure: (imapConfig.tls || imapConfig.secure || true),
      auth: { user, pass, accessToken }
    }

    if (!pass && !accessToken) {
      const oauthcfg = imapConfig.auth?.msxoauth
      if (!oauthcfg) {
        throw new Error('incorrect authentication credentials configuration')
      } else {
        const resp = await msxoauth2token(oauthcfg).catch(err => err)
        if (resp instanceof Error) {
          throw new Error('msxoauth token failed')
        }
        config.auth.accessToken = resp
      }
    }

    const client = new ImapFlow(config)
    await client.connect()
    this.mailboxLock = await client.getMailboxLock(folder || this.config.folders.INBOX)

    this.connection = client

    client.on('error', err => {
      console.log(`Error occurred: ${err.message}`)
    })
    client.on('close', evnt => {
      console.log(`Connection closed`)
    })

    return this
  }

  async searchMessages (searchCriteria = null) {
    // search using input or the fixed search from config file
    searchCriteria || (searchCriteria = this.config.searchCriteria)

    // https://imapflow.com/global.html#SearchObject link to all ImapFlow available options.
    // WARNING: searchCriteria could contain garbage data, should include mappings.
    //
    // also look https://gist.github.com/martinrusev/6121028
    //const search = {
    //  from: searchCriteria.from,
    //  subject: searchCriteria.subject,
    //  seen: searchCriteria.seen,
    //  since: searchCriteria.since
    //}

    // remove empty filters, the easy way
    const query = JSON.parse(JSON.stringify(searchCriteria))

    // by deafult use the body as filter, unless it is say the opposite.
    // some IMAP Server missunderstand the string used in body filtering
    // thus the search result will be empty
    if (process.env.USE_IMAP_BODY_FILTER === "false") {
      console.warn('WARN: body filter is disabled by env')
      delete query.body
    }

    const searchResult = await this.connection.search(query)
    if (searchResult === false) {
      console.error(`Error searching ${JSON.stringify(query)}`)
      throw new Error('query failed')
    }
    console.log(`${searchResult.length} messages with the selected criteria`)

    return searchResult.map(seq => new Message(seq, this))
  }

  closeConnection () {
    if (this.mailboxLock) {
      this.mailboxLock.release()
    }
    return this.connection.logout()
  }
}

const noopLogger = {
  debug () {},
  info () {},
  warn () {},
  error () {}
}

class Message {
  // private
  #mailbot
  data
  meta
  id
  uid
  seq

  constructor (seq, mailbot) {
    this.#mailbot = mailbot
    this.seq = seq
  }

  /**
   * @return Promise
   */
  move (folder) {
    if (this.#mailbot.config.moveProcessedMessages !== true) {
      console.log(`message won\'t be moved. moveProcessedMessages is disabled by config`)
      return
    }

    folder || (folder = this.#mailbot.config.folders.processed)

    if (!folder) {
      throw new Error(`Target folder to move messages needed`)
    }
    
    console.log(`moving message to ${folder}`)
    return (
      this.#mailbot.connection.messageMove(this.seq, folder).then(() => {
        console.log(`message moved to ${folder}`)
      })
    )
  }

  /**
   * @param {Mail} message
   * @param {Array} types list to search by admited extensions
   * @return {Array}
   */
  async getContent () {
    const { meta, content } = await this.download()

    if (!content) {
      throw new Error('cannot get mail content')
    }

    const rawData = await streamToString(content)

    this.rawData = rawData
    this.meta = meta
    this.data = await simpleParser(rawData)

    return this.data
  }

  async getId () {
    const uid = await this.#mailbot.connection.fetchOne(this.seq, { uid: true })
    Object.assign(this, uid)
    return uid
  }

  /**
   * @return {Promise}
   */
  download () {
    return this.#mailbot.connection.download(this.seq)
  }

  get date () {
    return this.data.date
  }

  /**
   * It takes the closest registered received date
   */
  get dateReceived () {
    const last = this.data.headers.get("received")[0]
    const parts = last.split(';')
    const date = new Date(parts[ parts.length - 1 ])
    return date
  }

  get from () {
    return this.data.from.value.map(from => from.address)[0]
  }

  get subject () {
    return this.data.subject
  }

  get body () {
    return this.data.text || ''
  }

  get text () {
    return this.data.text || ''
  }

  get html () {
    return this.data.html || ''
  }

  async searchBody (rule) {
    if (rule.format === 'text') {
      return this.text
    }
    if (rule.format === 'html') {
      return this.html
    }
  }

  async searchHeaders (rule) {
    if (Array.isArray(rule.select) && rule.select.length > 0) {
      const selected = []
      for (let xx = 0; xx < rule.select.length; xx++) {
        const key = rule.select[xx]
        for (let yy = 0; yy < this.data.headerLines.length; yy++) {
          if (key == this.data.headerLines[yy].key) {
            selected.push(this.data.headerLines[yy])
          }
        }
      }
      return selected
    } else {
      return this.data.headerLines
    }
  }

  async searchAttachments (rule) {
    const allowed = rule || this.#mailbot.config.attachments.allowed
    const attachments = []

    if (this.data.attachments.length) {
      for (const attachment of this.data.attachments) {
        if (allowed.dispositions.indexOf(attachment.contentDisposition) !== -1) {
          //const extension = path.extname(attachment.filename).replace(/[^\w\-. ]/g, '').toLowerCase()
          const extension = path.extname(attachment.filename).replace('.','').toLowerCase()

          if (extension && allowed.extensions.indexOf(extension) !== -1) {
            if (attachment.contentType === 'application/ms-tnef') {
              const files = await parseAsTnef(attachment.content)

              if (files.Attachments.length > 1) {
                throw new Error('Unhandled multiple TNEF attachments')
              }

              attachment.content = Buffer.from(files.Attachments[0].Data)
              attachment.filename = files.Attachments[0].Title
              attachment.contentType = mime.lookup(attachment.filename)
            }
            attachments.push(attachment)
          }
        }
      }
    }

    return attachments
  }

  async searchBodyAttachments (rule) {
    const attachments = []

    if (rule.url_patterns) {
      let bodyFormat = rule.body_format
      bodyFormat || (bodyFormat = 'text')
      if (bodyFormat !== 'text' && bodyFormat !== 'html') {
        throw new Error(`unsupported body format ${bodyFormat}`)
      }

      const bodyContent = this[bodyFormat]

      for (const urlPattern of rule.url_patterns) {
        const pattern = new RegExp(urlPattern.pattern, urlPattern.flags)
        const foundAttachments = bodyContent.match(pattern)
        // Ver de agregar handler para flag g y otros casos (algun dia)
        if (foundAttachments?.length) {
          for (let url of foundAttachments) {
            url = filterString(url, urlPattern.filters)
            const attachment = await downloadFile(url)
            attachments.push(attachment)
          }
        }
      }
    }

    return attachments
  }

  getParsedDate (options = {}) {
    const useReceivedDate = (
      process.env.USE_SERVER_RECEIVED_DATE === 'true' ||
      options?.useReceivedDate ||
      USE_SERVER_RECEIVED_DATE
    )

    let messageDate
    if (useReceivedDate === true) {
      console.log('useReceivedDate: Using server "Received" date')
      messageDate = this.dateReceived
    } else {
      console.log('Using message "Sent" date')
      messageDate = this.date
    }

    const ignoreMessageTimezone = (
      process.env.IGNORE_MESSAGES_TIMEZONE === 'true' ||
      options?.ignoreMessageTimezone ||
      IGNORE_MESSAGES_TIMEZONE
    )

    if (ignoreMessageTimezone === true) {
      console.log('ignoreMessageTimezone: Using timezone configuration')
      return ignoreOriginalTimezone(messageDate, options.timezone)
    } else {
      console.log('Using message timezone')
      return setTimezone(messageDate, options.timezone)
    }
  }

  satisfyBodyFilter (filterExpr) {
    if (!filterExpr) { return true }

    let bodyMatched
    let bodyText
    if (process.env.USE_IMAP_BODY_FILTER === "false") {
      bodyText = message.body.split(/[\n\s]/).join(' ')
      // filter by hand
      const pattern = new EscapedRegExp(filterExpr.trim())
      bodyMatched = pattern.test(bodyText)
    }

    if (bodyMatched === false) {
      console.log(`body not matched\n>> message body:\n${bodyText}\n>> search body:\n${filter}`)
    }

    return bodyMatched
  }
}

/**
 * Change date to the timezone
 *
 * @param {Date} date
 * @param {String} timezone
 * @return {DateTime} luxon
 */
const setTimezone = (date, timezone = TIMEZONE) => {
  return DateTime
    .fromISO(date.toISOString())
    .setZone(timezone)
}

/**
 * Keep the same date ignoring the original Timezone.
 * This is assuming that the original timezone is wrong
 * and it must be replaced by the real arrival time.
 *
 * @param {Date} date
 * @param {String} timezone
 * @return {DateTime} luxon
 */
const ignoreOriginalTimezone = (date, timezone = TIMEZONE) => {
  // use toISOString formatter in UTC/Zero timezone and remove the timezone part
  const trimmedDate = date.toISOString().replace(/\.[0-9]{3}Z$/, '')
  // create a new Date and initialize it using the desired timezone
  const tzDate = DateTime.fromISO(trimmedDate, { zone: timezone })
  return tzDate
}

const parseAsTnef = (dat) => {
  return new Promise((resolve, reject) => {
    tnef.parseBuffer(dat, (err, content) => {
      if (err) { reject(err) }
      else { resolve(content) }
    })
  })
}

const streamToString = (stream) => {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('error', (err) => reject(err))
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

const filterString = (str, filters) => {
  if (!filters?.length) { return str }
  return filters.reduce( (str, filter) => {
    if (filter.type == 'replace') {
      const pattern = new RegExp(filter.pattern, filter.flags)
      return str.replace(pattern, filter.replacement)
    } else {
      console.log('filter not implemented')
      return str
    }
  }, str)
}

const downloadFile = async (url) => {

  const vurl = new URL(url)
  const fileData = await got(vurl.href).catch(err => err.response)
  const disposition = fileData.headers['content-disposition']
  const matched = disposition ? disposition.match(/filename=(.*)/) : null

  let filename
  if (
    matched !== null &&
    Array.isArray(matched) &&
    matched[1]
  ) {
    filename = matched[1]
      .split(';')[0]
      .split('"')
      .join('')
      .replace(/[^\w\-.]/,'_')
  } else {
    const a = new URL(url)
    filename = path.basename(a.pathname)
  }

  const shasum = crypto.createHash('md5')
  shasum.update(fileData.rawBody)
  const checksum = shasum.digest('hex')

  return {
    type: 'body_link',
    content: Buffer.from(fileData.rawBody),
    contentType: fileData.headers['content-type'],
    filename,
    checksum,
    headers: fileData.headers,
  }
}

module.exports = MailBot
