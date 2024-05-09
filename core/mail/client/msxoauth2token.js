const got = require('got')
const xoauth2token = module.exports = async (config) => {
  const {
    tenant_id,
    client_id,
    client_secret,
    scope = 'https://outlook.office.com/.default',
    grant_type = 'client_credentials'
  } = config
 
  //const body = `client_id=${client_id}&scope=${scope}&client_secret=${client_secret}&grant_type=${grant_type}`
  const url = 'https://login.microsoftonline.com/' + tenant_id + '/oauth2/v2.0/token' 
  //const headers = { "content-type": "application/x-www-form-urlencoded" }

  const response = await got.post(url, {
    //headers,
    form: {
      tenant_id,
      client_id,
      client_secret,
      scope,
      grant_type
    },
    responseType: 'json'
  })

  const resbody = response?.body
  if (!resbody) {
    throw new Error('Request failed')
  }
  return resbody.access_token
}
