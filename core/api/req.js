const https = require('https')
const http = require('http')
const { URL } = require('url')

// const FormData = require('form-data')

module.exports = (options) => {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url)

    const request = (url.protocol === 'https:' ? https : http).request

    const requestOptions = Object.assign({}, options, {
      port: url.port,
      hostname: url.hostname,
      headers: {
        'content-type': 'application/json'
      },
      path: `${url.pathname}${url.search}`
    })

    const req = request(requestOptions)

    req.on('response', res => {
      const data = []

      res.on('data', chunk => {
        data.push(chunk)
      })

      res.on('end', () => {
        let payload;
        const buffer = Buffer.concat(data).toString()

        // assuming that the response is always JSON.
        // But better would be to check the response content-type header
        //if (/json/.test(res.headers['content-type'])) {
        try {
          payload = JSON.parse(buffer)
        } catch (e) {
          payload = buffer
        }
        //}
        res.body = payload

        // return the response object.
        // assign the body to a response property body
        resolve(res)
      })
    })

    req.on('error', reject)

    // json body.
    // it requires header: content-type: application/json
    // also JSON.stringify is required. don't trust the user
    if (options.json) {
      req.headers['content-type'] = 'application/json'
      req.write(JSON.stringify(options.json))
    }

    if (options.formData) {
      /**
       * already integrated with FormData
       * const formData = new FormData()
       * for (let field of options.formData) {
       *   formData.append(field, options.formData[field])
       * }
       **/
      options.formData.pipe(req)
    } else {
      req.end()
    }
  })
}
