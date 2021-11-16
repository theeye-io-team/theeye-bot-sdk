const https = require('https')
const http = require('http')
//const got = require('got')
const debug = require('debug')('theeye:indicator')
const { URL } = require('url')

const BASE_URL = process.env.THEEYE_API_URL || 'https://supervisor.theeye.io'

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
    const request = TheEyeIndicatorApi.Request({ url: fetchApi, method: 'get' })
    return request.then(response => {

      if (response.statusCode < 200 || response.statusCode > 300) {
        throw new Error(`${response.statusCode}: ${response.body}`)
      }

      const payload = JSON.parse(response.body)
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
      request = this.apiRequest({
        url: this.url,
        method: 'put', 
        json: this.properties
      })
    } else {
      request = this.apiRequest({
        url: this.url,
        method: 'post',
        json: this.properties
      })
    }

    return request.then(response => {

      if (response.statusCode < 200 || response.statusCode > 300) {
        throw new Error(`${response.statusCode}: ${response.body}`)
      }

      const body = JSON.parse(response.body)
      Object.assign(this.properties, body)

      debug(response.body, response.statusCode)
      return this
    })
  }

  destroy () {
    return this.apiRequest({ url: this.url, method: 'delete' }).then( response => {
      if (response.statusCode < 200 || response.statusCode > 300) {
        throw new Error(`${response.statusCode}: ${response.body}`)
      }
      debug(response.body, response.statusCode)
      return this
    })
  }

  apiRequest (options) {
    debug(options)

    const url = new URL(options.url)

    const reqOpts = Object.assign({}, options, {
      port: url.port,
      hostname: url.hostname,
      headers: {
        'content-type': 'application/json'
      },
      path: `${url.pathname}${url.search}`
    })

    const request = (url.protocol==='https:'?https:http).request

    return new Promise((resolve, reject) => {
      const req = request(reqOpts, res => {
        let str = ''
        res.on('data', d => {
          if (d) { str += d; }
        })
        res.on('end', () => {
          res.body = str
          resolve(res)
        })
      })
      req.on('error', error => {
        reject(error)
      })
      if (options.json) {
        req.write(JSON.stringify(options.json))
      }
      req.end()
    })
  }

  static Request (options) {
    debug(options)

    const url = new URL(options.url)

    const reqOpts = Object.assign({}, options, {
      port: url.port,
      hostname: url.hostname,
      headers: {
        'content-type': 'application/json'
      },
      path: `${url.pathname}${url.search}`
    })

    const request = (url.protocol==='https:'?https:http).request

    return new Promise((resolve, reject) => {
      const req = request(reqOpts, res => {
        let str = ''
        res.on('data', d => {
          if (d) { str += d; }
        })
        res.on('end', () => {
          res.body = str
          resolve(res)
        })
      })
      req.on('error', error => {
        reject(error)
      })
      if (options.json) {
        req.write(JSON.stringify(options.json))
      }
      req.end()
    })
  }

}

module.exports = TheEyeIndicatorApi
