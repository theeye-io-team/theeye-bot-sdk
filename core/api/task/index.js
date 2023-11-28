const got = require('got')

const THEEYE_ACCESS_TOKEN = process.env.THEEYE_ACCESS_TOKEN

const THEEYE_BASE_URL = JSON.parse(process.env.THEEYE_API_URL || '"https://supervisor.theeye.io"')

class TheEyeTask {
  constructor (specs = {}) {
    this.apiUrl = (specs.apiUrl || THEEYE_BASE_URL)
    this.customerName = specs.customerName

    if (!this.customerName) {
      if (process.env.THEEYE_ORGANIZATION_NAME) {
        try {
          this.customerName = JSON.parse(process.env.THEEYE_ORGANIZATION_NAME)
        } catch (err) {
          console.error(err.message)
          this.customerName = null
        }
      }
    }

    this.id = (specs.id || process.env.TASK_ID)
    this.secret = (specs.secret || process.env.TASK_SECRET)


    if (this.customerName) {
      this.urlRoot = `${this.apiUrl}/${this.customerName}/task`
    } else {
      this.urlRoot = `${this.apiUrl}/task`
    }

    if (TheEyeTask.accessToken) {
      this.accessToken = TheEyeIndicator.accessToken
    }
  }

  /**
   * @return {Task}
   * @param {Object} options
   * @prop {String} id
   * @prop {String} secret
   * @prop {Array} task_arguments
   * @prop {Mixed} body
   */
  async run (options = {}) {
    let { id, secret } = options
    
    id || (id = this.id)
    secret || (secret = this.secret)
    
    if (!secret && !this.accessToken) {
      throw new Error('missing credentials: access token or secret required')
    }
    
    if (options.task_arguments && !Array.isArray(options.task_arguments)) {
      throw new Error('task_arguments: array expected')
    }

    let body
    if (options.task_arguments) {
      body = { task_arguments: options.task_arguments }
    } else if (options.body) {
      body = options.body
    }
    
    let url
    if (secret) {
      url = `${this.urlRoot}/${id}/secret/${secret}/job`
    } else {
      // need access token
      url = `${this.urlRoot}/${id}/job?customer=${this.customerName}&access_token=${this.accessToken}`
    }

    try {
      const response = await got.post(url, {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        responseType: 'json'
      })

      return response.body
    } catch (err) {
      console.log(err.message)
      throw new Error(`[${err.response.statusCode}] ${err.response.body}`)
    }
  }
}

if (THEEYE_ACCESS_TOKEN) {
  TheEyeIndicator.accessToken = THEEYE_ACCESS_TOKEN
}

module.exports = TheEyeTask
