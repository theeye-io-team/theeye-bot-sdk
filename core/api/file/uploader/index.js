require('dotenv').config()
const FileApi = require('theeye-bot-sdk/core/api/file')
const { createHandler, executeHandler } = require('theeye-bot-sdk/core/boilerplate')
const fs = require('fs')

const main = async () => {
  /**
   * required values.
   *
   * filename
   * extension
   * mimetype
   *
   * content to create or update
   */

  const filename = './package.json'
  const content = fs.readFileSync(filename, 'utf8')
  return FileApi.Upsert({ filename, content })
}

module.exports = createHandler(main, module)
