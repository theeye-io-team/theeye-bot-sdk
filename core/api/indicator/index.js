const debug = require('debug')('theeye:indicator')

const BASE_URL = JSON.parse(process.env.THEEYE_API_URL || JSON.stringify('https://supervisor.theeye.io'))

const Request = require('../req')

class TheEyeIndicatorApi {

  constructor (properties = {}, settings = {}) {

    const { title, type } = properties

    if (!title) {
      throw new Error('Indicator "title" is requiered')
    }

    this.settings = {}
    this.properties = {}

    Object.assign(this.settings, settings)
    Object.assign(this.properties, properties)

    this.properties.type = (type || 'text')
  }

  get url () {
    const titleURLEncoded = encodeURIComponent(this.properties.title)
    const rootURL = `${this.baseUrl}/indicator`

    let url
    if (this.properties.id) {
      url = `${rootURL}/title/${titleURLEncoded}?access_token=${this.accessToken}`
    } else {
      url = `${rootURL}?access_token=${this.accessToken}`
    }
    return url
  }

  get baseUrl () {
    return this.settings.baseUrl || BASE_URL
  }

  get accessToken () {
    const token = this.settings.accessToken || process.env.THEEYE_ACCESS_TOKEN
    return token
  }

  static Fetch (options = {}) {
    let { baseUrl, accessToken } = options

    baseUrl || (baseUrl = BASE_URL)

    const fetchApi = `${baseUrl}/indicator?access_token=${accessToken}`
    const request = Request({ url: fetchApi, method: 'get' })
    return request.then(response => {

      if (response.statusCode < 200 || response.statusCode > 300) {
        throw new Error(`${response.statusCode}: ${response.body}`)
      }

      const payload = response.body
      const indicators = []
      for (let properties of payload) {
        indicators.push( new TheEyeIndicatorApi(properties, { baseUrl, accessToken }) )
      }

      return indicators
    })
  }

  save () {
    let request
    if (this.properties.id) {
      request = Request({
        url: this.url,
        method: 'put', 
        json: this.properties
      })
    } else {
      request = Request({
        url: this.url,
        method: 'post',
        json: this.properties
      })
    }

    return request.then(response => {

      if (response.statusCode < 200 || response.statusCode > 300) {
        throw new Error(`${response.statusCode}: ${response.body}`)
      }

      const body = response.body
      Object.assign(this.properties, body)

      debug(response.body, response.statusCode)
      return this
    })
  }

  destroy () {
    return Request({ url: this.url, method: 'delete' }).then( response => {
      if (response.statusCode < 200 || response.statusCode > 300) {
        throw new Error(`${response.statusCode}: ${response.body}`)
      }
      debug(response.body, response.statusCode)
      return this
    })
  }
}

module.exports = TheEyeIndicatorApi
