const got = require('got')

const THEEYE_BASE_URL = JSON.parse(process.env.THEEYE_API_URL || '"https://supervisor.theeye.io"')
const THEEYE_ACCESS_TOKEN = process.env.THEEYE_ACCESS_TOKEN

class TheEyeIndicator {

  constructor (title, type, order) {
    this.apiURL = THEEYE_BASE_URL
    this.customerName = JSON.parse(process.env.THEEYE_ORGANIZATION_NAME || 'null')

    this.title = title
    this.type = (type || 'text')
    this.order = (order || 0)

    if (TheEyeIndicator.accessToken) {
      this.accessToken = TheEyeIndicator.accessToken
    }
  }

  set (values) {
    for (let prop in values) {
      this[prop] = values[prop]
    }
    return this
  }

  get url () {
    const titleURLEncoded = encodeURIComponent(this.title)
    const url = `${this.apiURL}/indicator/title/${titleURLEncoded}?access_token=${this.accessToken}`

    if (this.customerName) {
      return `${url}&customer=${this.customerName}`
    }

    return url
  }

  async put () {
    const payload = {
      title: this.title,
      state: this.state,
      value: this.value,
      type: this.type,
      order: this.order,
      severity: this.severity,
      acl: this.acl,
      tags: this.tags
    }

    let response

    try {
      response = await got.put(this.url, {
        json: payload,
        responseType: 'json'
      })
    } catch (err) {
      const reqErr = new Error(`${err.response.statusCode}: ${JSON.stringify(err.response.body)}`)
      console.error(reqErr)
      response = err
    }

    return response
  }

  static Fetch () {
    const url = `${THEEYE_BASE_URL}/indicator?access_token=${TheEyeIndicator.accessToken}`
    return got(url).catch(err => {
      const reqErr = new Error(`${err.response.statusCode}: ${err.response.body}`)
      console.error(reqErr)
      return err.response
    })
  }

  static async Get (key) {
    let url
    if (key.id) {
      url = `${THEEYE_BASE_URL}/indicator/${key.id}?access_token=${TheEyeIndicator.accessToken}`
    } else if (key.title) {
      url = `${THEEYE_BASE_URL}/indicator/title/${key.title}?access_token=${TheEyeIndicator.accessToken}`
    }

    const response = await got(url, { responseType: 'json' })
    const values = response.body

    const indicator = new TheEyeIndicator()
    indicator.set(values)
    return indicator
  }

  async patch (payload) {
    if (!payload) {
      payload = {
        title: this.title,
        state: this.state,
        value: this.value,
        type: this.type,
        order: this.order,
        severity: this.severity,
        acl: this.acl,
        tags: this.tags
      }
    }

    let response

    try {
      response = await got.patch(this.url, {
        json: payload,
        responseType: 'json'
      })
    } catch (err) {
      const reqErr = new Error(`${err.response.statusCode}: ${JSON.stringify(err.response.body)}`)
      console.error(reqErr)
    }

    return response
  }

  async remove () {
    let response
    try {
      response = await got.delete(this.url)
    } catch (err) {
      const reqErr = new Error(`${err.response.statusCode}: ${err.response.body}`)
      console.error(reqErr)
    }

    return response
  }

  static async SortByTag (tag, order = 1000, direction = 1) {
    const { body } = await TheEyeIndicator.Fetch()

    const indicators = JSON.parse(body)
      .filter(i => i.tags.includes(tag))
      .sort((elem1, elem2) => {
        const elem1Date = new Date(elem1.creation_date).getTime()
        const elem2Date = new Date(elem2.creation_date).getTime()
        // orden inverso. primero el mas nuevo
        return ((elem1Date > elem2Date) ? 1 : -1) * direction
      })

    for (const data of indicators) {
      const indicator = new TheEyeIndicator(data.title, data.type)
      await indicator.patch({ order })
      order++
    }
  }
}

if (THEEYE_ACCESS_TOKEN) {
  TheEyeIndicator.accessToken = THEEYE_ACCESS_TOKEN
}

module.exports = TheEyeIndicator
