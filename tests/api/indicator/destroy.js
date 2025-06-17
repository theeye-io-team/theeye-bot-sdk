
const Indicators = require('../../../core/api/indicator')
const ACCESS_TOKEN = process.env.THEEYE_ACCESS_TOKEN
const BASE_URL = JSON.parse(process.env.THEEYE_API_URL||'"https//supervisor.theeye.io"')

const main = module.exports = async () => {

  const indicators = await Indicators.Fetch({ baseUrl: BASE_URL, accessToken: ACCESS_TOKEN })

  for (let indicator of indicators) {
    const response = await indicator.destroy()
  }

  return {}
}

main().then(console.log).catch(console.error)
