const { ImapFlow } = require('imapflow')
const { DateTime } = require('luxon')
//const rfc2047 = require('rfc2047')
const path = require('path')
const got = require('got')
const { simpleParser } = require('mailparser')
const tnef = require('node-tnef')
const mime = require('mime-types')
const crypto = require('crypto')
const { JSDOM } = require('jsdom')

const logger = require('../../logger')('mailbot')
const EscapedRegExp = require('../../escaped-regexp')

const IGNORE_MESSAGES_TIMEZONE = false
const TIMEZONE = 'America/Argentina/Buenos_Aires'

const Authentication = require('../../authentication')

/**
 * @class MailBot
 */
class MailBot {
  /** @private mail client configuration */
  config

  constructor (config) {
    this.config = config
  }

  async connect (folder = null) {
    const imapConfig = this.config.imap

    const auth = await Authentication(
      Object.assign(
        {
          user: imapConfig.user,
          pass: imapConfig.password,
          accessToken: imapConfig.accessToken
        },
        imapConfig.auth
      )
    )

    const config = {
      logger: (imapConfig.debug===true?logger:noopLogger),
      emitLogs: (imapConfig.emitLogs || false),
      host: imapConfig.host,
      port: (imapConfig.port || 993),
      secure: (imapConfig.tls || imapConfig.secure || true),
      auth
    }

    const client = new ImapFlow(config)
    await client.connect()
    
    // NUEVO: Solo hacer lock de carpeta si se especifica (backward compatibility)
    if (folder !== null) {
      this.mailboxLock = await client.getMailboxLock(folder || this.config.folders?.INBOX)
    }

    this.connection = client

    client.on('error', err => {
      console.log(`Error occurred: ${err.message}`)
    })
    client.on('close', evnt => {
      console.log(`Connection closed`)
    })

    return this
  }

  /**
   * Selecciona y bloquea una carpeta específica
   * @param {string} folder - Nombre de la carpeta a seleccionar
   * @returns {Promise<Object>} - Lock object de la carpeta
   */
  async selectFolder(folder) {
    if (!this.connection) {
      throw new Error('Must connect first before selecting a folder')
    }

    // Liberar lock anterior si existe
    if (this.mailboxLock) {
      this.mailboxLock.release()
    }

    // Obtener nuevo lock para la carpeta
    this.mailboxLock = await this.connection.getMailboxLock(folder)
    return this.mailboxLock
  }

  /**
   * Libera el lock de la carpeta actual sin desconectar
   */
  releaseFolder() {
    if (this.mailboxLock) {
      this.mailboxLock.release()
      this.mailboxLock = null
    }
  }

  async searchMessages (searchCriteria = null) {
    // Verificar que haya una carpeta seleccionada
    if (!this.mailboxLock) {
      throw new Error('No folder selected. Use selectFolder() or connect() with folder parameter first.')
    }

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
    if (process.env.USE_MAIL_BODY_FILTER === "false") {
      console.warn('WARN: body filter is disabled by env')
      delete query.body
    }

    const searchResult = await this.connection.search(query)
    if (searchResult === false) {
      console.error(`Error searching ${JSON.stringify(query)}`)
      throw new Error('query failed')
    }
    console.log(`${searchResult.length} messages with the selected criteria`)

    return searchResult.map(seq => new ImapMessage(seq, this))
  }

  disconnect () {
    return this.closeConnection()
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
  /** @private mail client instance */
  client

  /** @type {Object} Parsed email data from mailparser */
  data

  /** @type {Object} Email metadata from mail server */
  meta

  /** @type {string} Message ID */
  id

  /** @type {number} Unique identifier for message */
  uid

  /** @type {number} Message sequence number */
  seq

  /**
   * @param {string} id message ID
   * @param {Object} client mail client instance
   */
  constructor(id, client) {
    this.seq = this.id = id
    this.client = client
  }

  get date () {
    return this.data.date
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

  searchBody (rule) {
    if (rule.format === 'text') {
      return this.text
    }
    if (rule.format === 'html') {
      if (rule.extractText === true) {
        const dom = new JSDOM(this.html)
        return dom.window.document.body.textContent
      } else {
        return this.html
      }
    }
  }

  searchHeaders (rule) {
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

  async searchBodyAttachments (rule) {
    const attachments = []

    if (rule.urlPatterns) {
      let bodyFormat = rule.bodyFormat
      bodyFormat || (bodyFormat = 'text')
      if (bodyFormat !== 'text' && bodyFormat !== 'html') {
        throw new Error(`unsupported body format ${bodyFormat}`)
      }

      const bodyContent = this[bodyFormat]

      for (const urlPattern of rule.urlPatterns) {
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
      options?.useReceivedDate
    )

    const useSentDate = (
      process.env.USE_SERVER_SEND_DATE === 'true' ||
      options?.useSentDate
    )

    let messageDate
    if (useSentDate === true) {
      console.log('Using message "sent" date')
      messageDate = this.date
      console.log('message "sent" date is: ' + messageDate)
    } else if (useReceivedDate === true) {
      console.log('useReceivedDate: Using server "Received" date')
      messageDate = this.dateReceived
      console.log('message "received" date is: ' + messageDate)
    } else {
      console.log('Using message "received" date')
      messageDate = this.date
      console.log('message "received" date is: ' + messageDate)
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
      bodyText = this.body.split(/[\n\s]/).join(' ')
      // filter by hand
      const pattern = new EscapedRegExp(filterExpr.trim())
      bodyMatched = pattern.test(bodyText)
    }

    if (bodyMatched === false) {
      console.log(`body not matched\n>> message body:\n${bodyText}\n>> search body:\n${filter}`)
    }

    return bodyMatched
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
}

/**
 * @class ImapMessage
 */
class ImapMessage extends Message {

  /**
   * @param {number} seq message sequence number
   * @param {Object} client IMAP client instance
   */
  constructor (seq, client) {
    super(seq, client)
  }

  /**
   * @return Promise
   */
  move (folder) {
    if (this.client.config.moveProcessedMessages !== true) {
      console.log(`message won\'t be moved. moveProcessedMessages is disabled by config`)
      return
    }

    folder || (folder = this.client.config.folders?.processed)

    if (!folder) {
      throw new Error(`Target folder to move messages needed`)
    }
    
    console.log(`moving message to ${folder}`)
    return (
      this.client.connection.messageMove(this.seq, folder).then(() => {
        console.log(`message moved to ${folder}`)
      })
    )
  }

  /**
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
    const uid = await this.client.connection.fetchOne(this.seq, { uid: true })
    Object.assign(this, uid)
    return uid
  }

  /**
   * @return {Promise}
   */
  download () {
    return this.client.connection.download(this.seq)
  }

  async searchAttachments (rule) {
    const allowed = rule || this.client.config.attachments?.allowed
    const attachments = []

    if (this.data.attachments.length) {
      for (const attachment of this.data.attachments) {
        if (allowed.dispositions.indexOf(attachment.contentDisposition) !== -1) {

          if (!attachment?.filename) {
            console.log('WARN: attachment has no filename')
            continue
          }

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

MailBot.Message = Message

MailBot.ImapMessage = ImapMessage

module.exports = MailBot
