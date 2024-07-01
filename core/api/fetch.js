
const THEEYE_ACCESS_TOKEN = process.env.THEEYE_ACCESS_TOKEN
const THEEYE_BASE_URL = JSON.parse(process.env.THEEYE_API_URL || '"https://supervisor.theeye.io"')

const axios = require('axios')

class TheEyeFetch {

  async Fetch (api, where) {

    const token = TheEyeFetch.accessToken

    const query = qs.stringify({
      where: { name }
    })

    const url = `${THEEYE_BASE_URL}/${api}?${query}`

    return await axios({
      url,
      method: 'get',
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => {
      return response.data
    })
  }
}

if (THEEYE_ACCESS_TOKEN) {
  TheEyeFetch.accessToken = THEEYE_ACCESS_TOKEN
}

module.exports = TheEyeFetch
