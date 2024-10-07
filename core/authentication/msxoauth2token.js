const got = require('got')
const xoauth2token = module.exports = async (config) => {
  const {
    tenant_id,
    client_id,
    client_secret,
    // default values
    scope = 'https://outlook.office.com/.default',
    grant_type = 'client_credentials'
  } = config
 
  const url = 'https://login.microsoftonline.com/' + tenant_id + '/oauth2/v2.0/token' 

  const response = await got.post(url, {
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
