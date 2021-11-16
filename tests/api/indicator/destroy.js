
const Indicators = require('../../../core/api/indicator')
const accessToken = process.env.ACCESS_TOKEN
const baseUrl = process.env.THEEYE_API_URL || 'https://supervisor.theeye.io'

const main = async () => {

  const indicators = await Indicators.Fetch({ baseUrl, accessToken })

  for (let indicator of indicators) {
    const response = await indicator.destroy()
  }

  return {}
}

main().then(console.log).catch(console.error)
