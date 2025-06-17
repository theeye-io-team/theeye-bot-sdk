
const THEEYE_GATEWAY_URL = JSON.parse(process.env.THEEYE_GATEWAY_URL || '"https://app.theeye.io"')
const THEEYE_ACCESS_TOKEN = process.env.THEEYE_ACCESS_TOKEN

const axios = require('axios')

class TheEyeSession {
  constructor (accessToken = null) {
    this.apiURL = THEEYE_GATEWAY_URL + '/api/session'
    this.accessToken = accessToken || THEEYE_ACCESS_TOKEN

    if (!this.accessToken) {
      throw new Error('access token is required')
    }

    axios.defaults
      .headers
      .common['Authorization'] = `Bearer ${this.accessToken}`
  }

  getProfile () {
    return axios
      .get(this.apiURL + '/profile')
      .then(response => response.data)
  }
}

if (THEEYE_ACCESS_TOKEN) {
  TheEyeSession.accessToken = THEEYE_ACCESS_TOKEN
}

module.exports = TheEyeSession
