const { HttpsProxyAgent } = require('https-proxy-agent')
const axios = require('axios')
const { Message } = require('./imap')
const qs = require('qs');
const fs = require('fs')

const debug = require('debug')('core::mail:client::msgraph')

/**
 * @class MsGraphMailbot
 */
class MsGraphMailbot {

  /**
   * @param {Object} config graph config
   * @property {Object} config.auth auth config
   * @property {String} config.auth.tenantId tenant id
   * @property {String} config.auth.clientId client id
   * @property {String} config.auth.clientSecret client secret
   * @property {String} config.auth.user user
   * @property {Object} config.auth.options auth options
   * @property {Object} config.proxy proxy config
   * @property {Boolean} config.proxy.enabled true/false
   * @property {String} config.proxy.host host
   * @property {String} config.proxy.port port
   * @property {String} config.apiBaseUrl api base url
   * @property {String} config.searchUrl search url
   */
  constructor(config) {
    if (!config.msGraph) {
      throw new Error('msGraph config is required')
    }
    this.config = config
  }

  /**
   * Connect to the Microsoft Graph API
   * @param {string|null} folder - Optional folder name for backward compatibility
   * @returns {Promise<void>}
   */
  async connect(folder = null) {
    try {
      const cachedToken = this.loadCachedToken()
      if (cachedToken) {
        this.token = cachedToken
        this.connectionTime = new Date()
        
        // NUEVO: Configurar carpeta inicial si se especifica (backward compatibility)
        if (folder !== null) {
          this.selectFolder(folder)
        }
        
        return
      }

      const { auth } = this.config.msGraph
      const { tenantId, clientId, clientSecret, scopeUrl, options = {} } = auth

      let url = `${options.authorityHost}${tenantId}/oauth2/v2.0/token`

      const params = new URLSearchParams()
      params.append('client_id', clientId)
      params.append('client_secret', clientSecret)
      params.append('grant_type', 'client_credentials')
      params.append('scope', scopeUrl)

      const proxyAgent = this.createProxyAgent()
      const response = await axios({
        method: 'POST',
        url,
        data: params.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        proxy: false, // disable internal axios proxy
        proxyAgent
      })

      this.token = response.data.access_token
      this.connectionTime = new Date()
      
      // NUEVO: Configurar carpeta inicial si se especifica (backward compatibility)
      if (folder !== null) {
        this.selectFolder(folder)
      }
      
    } catch (error) {
      console.error('Error authenticating:', error.response?.data || error.message)
      throw new Error('Failed to authenticate with Microsoft Graph')
    }
  }

  /**
   * Selecciona una carpeta específica para las operaciones de búsqueda
   * @param {string} folder - Nombre de la carpeta (ej: 'inbox', 'sent', nombre personalizado)
   * @returns {string} - El searchUrl actualizado para la carpeta
   */
  selectFolder(folder) {
    if (!folder) {
      throw new Error('Folder name is required')
    }

    // Normalizar nombre de carpeta para Graph API
    const normalizedFolder = this._normalizefolderName(folder)
    
    // Actualizar searchUrl dinámicamente
    this.currentFolder = folder
    this.currentSearchUrl = `/users/{userId}/mailFolders('${normalizedFolder}')/messages`
    
    return this.currentSearchUrl
  }

  /**
   * Libera la carpeta actual (método por consistencia de API con IMAP)
   * En Graph API no hay locks, pero mantiene consistencia
   */
  releaseFolder() {
    this.currentFolder = null
    this.currentSearchUrl = null
  }

  /**
   * Normaliza el nombre de carpeta para la API de Graph
   * @param {string} folder - Nombre de carpeta original
   * @returns {string} - Nombre normalizado para Graph API
   */
  _normalizefolderName(folder) {
    // Mapeo de nombres comunes
    const folderMapping = {
      'INBOX': 'inbox',
      'Inbox': 'inbox', 
      'inbox': 'inbox',
      'SENT': 'sentitems',
      'Sent': 'sentitems',
      'sent': 'sentitems',
      'TRASH': 'deleteditems',
      'Trash': 'deleteditems',
      'trash': 'deleteditems',
      'DRAFTS': 'drafts',
      'Drafts': 'drafts',
      'drafts': 'drafts'
    }

    return folderMapping[folder] || folder
  }

  /**
   * Load cached token from file if it exists and is still valid
   * @returns {String|null} The cached token if valid, null otherwise
   */
  loadCachedToken() {
    try {
      const tokenPath = './token.json'
      if (fs.existsSync(tokenPath)) {
        const savedToken = JSON.parse(fs.readFileSync(tokenPath))
        
        // Extract expiry from JWT token payload
        const tokenParts = savedToken.access_token.split('.')
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
        const expiryTime = payload.exp * 1000 - (5 * 60 * 1000) // Convert to ms and subtract 5min buffer
        
        const now = Date.now()
        if (now < expiryTime) {
          debug('Using cached token')
          return savedToken.access_token
        }
        debug('Token expired or about to expire')
      }
    } catch (err) {
      debug('Error reading token file:', err.message)
    }
    return null
  }

  /**
   * Get proxy configuration
   * @returns {HttpsProxyAgent} proxy agent
   */
  createProxyAgent() {
    const proxy = this.config.msGraph.proxy
    if (!proxy || proxy.enabled === false) {
      return null
    }

    if (!proxy.host || !proxy.port) {
      throw new Error('Proxy configuration is missing host or port')
    }

    return new HttpsProxyAgent(proxy)
  }

  /**
   * Get connection information similar to IMAP client interface
   * @returns {Object} Connection information with serverInfo
   */
  get connection() {
    const { tenantId, clientId, user } = this.config.msGraph.auth
    return {
      serverInfo: {
        type: 'MsGraph',
        authenticated: !!this.token,
        tenantId,
        clientId,
        user,
        connectionTime: this.connectionTime
      }
    }
  }

  /**
   * Search messages in the mailbox
   * @param {Object} searchCriteria search criteria
   * @returns {Array<Message>} messages
   */
  async searchMessages(searchCriteria) {
    try {
      const config = this.config.msGraph;
      const { apiBaseUrl, encodeSearchParams = false } = config;
      
      // NUEVO: Usar carpeta dinámica o fallback a configuración
      let searchUrl = this.currentSearchUrl || config.searchUrl
      
      // Validación: debe haber una carpeta seleccionada o configurada
      if (!searchUrl) {
        throw new Error('No folder selected. Use selectFolder() or connect() with folder parameter first.')
      }
  
      const filters = [];
  
      if (searchCriteria) {
        // Filter by sender
        if (searchCriteria.hasOwnProperty('from')) {
          if (process.env.USE_MAIL_FROM_FILTER === "false") {
            console.warn('WARN: from filter is disabled by env');
          } else {
            if (typeof searchCriteria.from !== 'string') {
              throw new Error('from parameter must be a string value');
            }
            filters.push(`from/emailAddress/address eq '${searchCriteria.from}'`);
          }
        }
  
        // Filter by subject
        if (searchCriteria.hasOwnProperty('subject')) {
          if (typeof searchCriteria.subject !== 'string') {
            throw new Error('subject parameter must be a string value');
          }
          filters.push(`contains(subject,'${searchCriteria.subject}')`);
        }
  
        // Filter by body content
        if (searchCriteria.hasOwnProperty('body')) {
          if (process.env.USE_MAIL_BODY_FILTER === "false") {
            console.warn('WARN: body filter is disabled by env');
          } else {
            if (typeof searchCriteria.body !== 'string') {
              throw new Error('body parameter must be a string value');
            }
            filters.push(`contains(body/content,'${searchCriteria.body}')`);
          }
        }
  
        // Filter by read status
        if (searchCriteria.hasOwnProperty('seen') && searchCriteria.seen !== undefined) {
          if (typeof searchCriteria.seen !== 'boolean') {
            throw new Error('seen parameter must be a boolean value');
          }
          filters.push(`isRead eq ${searchCriteria.seen}`);
        }
  
        // Filter by reception time (in hours)
        if (searchCriteria.hasOwnProperty('since')) {
          const sinceDate = new Date(searchCriteria.since);
          if (sinceDate.toString() === 'Invalid Date') {
            throw new Error('since parameter must be a valid ISO date string');
          }
          const endDate = new Date(sinceDate.getTime() + (48 * 60 * 60 * 1000)); // 48 hours after since date
          filters.push(`receivedDateTime ge ${sinceDate.toISOString()} and receivedDateTime lt ${endDate.toISOString()}`);
        }
      }
  
      // Build URL with qs
      const userId = this.config.msGraph.auth.user

      let queryParams = ''
      if (filters.length > 0) {
        const $filter = (filters.length === 1) ? filters[0] : filters.join(' and ')
        const filtersqs =  qs.stringify({ $filter }, { encode: encodeSearchParams })
        queryParams = `?${filtersqs}`
      }

      const url = `${apiBaseUrl}${searchUrl.replace('{userId}', userId)}${queryParams}`

      // proxy -> url:port
      const proxyAgent = this.createProxyAgent()
      const requestOptions = {
        method: 'GET',
        url,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        proxy: false, // disable internal axios proxy
        proxyAgent
      }

      debug(requestOptions)
  
      const response = await axios(requestOptions)

      //debug(response)
  
      const messages = this.applyLocalFilters(response.data.value, searchCriteria);
      console.log(`${messages.length} messages with the selected criteria`);
      return messages.map(msg => new MsGraphMessage(msg, this));
  
    } catch (error) {
      console.error('Error fetching messages:', error.response?.data || error.message);
      throw new Error('Failed to fetch messages');
    }
  }

  applyLocalFilters (messages, searchCriteria) {
    const { body: bodyFilter, from: fromFilter } = searchCriteria

    const filteredMessages = []

    for (const message of messages) {
      if (process.env.USE_MAIL_FROM_FILTER === "false") {
        if (fromFilter) {
          if (message.from.emailAddress.address !== fromFilter) {
            this.dumpRawMessage(message)
            console.log(`from not matched\n>> message from:\n${message.from.emailAddress.address}\n>> search from:\n${fromFilter}`)
            continue
          }
        }
      }

      if (process.env.USE_MAIL_BODY_FILTER === "false") {
        if (bodyFilter) {
          // Normalize whitespace: replace any sequence of whitespace characters with a single space
          const bodyText = message.body.content.replace(/\s+/g, ' ').trim()
          const bodyFilterText = bodyFilter.replace(/\s+/g, ' ').trim()
          const pattern = new RegExp(bodyFilterText, 'i')
          
          if (!pattern.test(bodyText)) {
            this.dumpRawMessage(message)
            console.log(`body not matched\n>> message body:\n${bodyText}\n>> search body:\n${bodyFilterText}`)
            continue
          }
        }
      }

      filteredMessages.push(message)
    }

    return filteredMessages
  }

  dumpRawMessage(message) {
    console.log('id:            ', message.id)
    console.log('subject:       ', message.subject)
    console.log('from:          ', message.from.emailAddress.address)
    console.log('body:          ', message.body.content)
    console.log('date received: ', message.receivedDateTime)
    console.log('date sent:     ', message.sentDateTime)
  }
  
  disconnect() {
    this.token = null
    this.connectionTime = null
  }

  closeConnection() {
    this.disconnect()
  }

  async moveMessage (messageId, folderName) {
    if (this.config.moveProcessedMessages !== true) {
      debug(`Message won't be moved. moveProcessedMessages is disabled by config`)
      return false
    }

    folderName = (folderName || this.config.folders?.processed)
    if (!folderName) {
      debug(`Target folder to move messages needed`)
      return false
    }

    debug(`moving message to ${folderName}`)

    const folderId = await this.getFolderIdByName(folderName)

    const { apiBaseUrl } = this.config.msGraph
    const { user } = this.config.msGraph.auth

    const url = `${apiBaseUrl}/users/${user}/messages/${messageId}/move`

    const proxyAgent = this.createProxyAgent()
    const requestOptions = {
      method: 'POST',
      url,
      data: { destinationId: folderId },
      headers: { Authorization: `Bearer ${this.token}` },
      proxy: false, // disable internal axios proxy
      proxyAgent
    }
    return axios(requestOptions)
  }

  /**
   * Devuelve el ID de una carpeta específica, dada su displayName.
   * @param {string} folderName El nombre de la carpeta que estamos buscando
   * @returns {string|null} El ID de la carpeta o null si no se encuentra
   */
  async getFolderIdByName (folderName) {
    const { apiBaseUrl } = this.config.msGraph
    const userId = this.config.msGraph.auth.user
    const url = `${apiBaseUrl}/users/${userId}/mailFolders`

    const response = await this.axiosInstance.get(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    })

    const folder = response.data.value
      .find((f) => f.displayName === folderName)

    if (!folder?.id) {
      throw new Error(`Folder with name "${folderName}" not found`)
    }

    return folder.id
  }

  /**
   * download message attachments
   * @returns {Promise}
   */
  async download (messageId) {
    // @TODO: test download attachments
    const { apiBaseUrl } = this.config.msGraph
    const { user } = this.config.msGraph.auth

    const url = `${apiBaseUrl}/users/${user}/messages/${messageId}/attachments`
    return this.axiosInstance.get(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    })
  }
}

class MsGraphMessage extends Message {

  /**
   * Constructor for MsGraphMessage
   * @param {Object} msg message object
   * @param {MsGraphMailbot} msGraphMailbot instance
   */
  constructor(msg, msGraphMailbot) {
    super(msg.id, msGraphMailbot)
    this.meta = msg
    this.data = this.messageToSimpleParser(msg)
  }

  messageToSimpleParser(msg) {
    return {
      date: new Date(msg.receivedDateTime),
      headers: new Map([['received', [msg.receivedDateTime]]]),
      from: {
        value: [{
          address: msg.from.emailAddress.address
        }]
      },
      subject: msg.subject,
      text: msg.body.content,
      html: msg.body.content
    }
  }

  /**
   * Move message to a folder
   * @param {String} folderName folder name
   * @returns {Promise<Object>} response
   */
  async move(folderName) {
    try {
      const messageId = this.meta.id
      const response = await this.client.moveMessage(messageId, folderName)
      if (response !== false) {
        debug(`Message ${messageId} moved to folder with name ${folderName}`)
        return response.data
      }
    } catch (error) {
      console.error('Error moving message:', error.response?.data || error.message)
      throw new Error('Failed to move message')
    }
  }

  get body() {
    return this.data.text
  }

  getContent() {
    return this.data
  }

  getId() {
    return this.meta.id
  }

  async downloadAttachments() {
    const response = await this.client.download(this.meta.id)
    return response.data
  }

  dump () {
    console.log('id:            ', this.meta.id)
    console.log('subject:       ', this.meta.subject)
    console.log('from:          ', this.meta.from.emailAddress.address)
    console.log('body:          ', this.meta.body.content)
    console.log('date received: ', this.meta.receivedDateTime)
    console.log('date sent:     ', this.meta.sentDateTime)
  }

}

MsGraphMailbot.Message = MsGraphMessage

module.exports = MsGraphMailbot

