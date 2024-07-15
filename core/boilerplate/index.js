
const path = require('path')

// set environment variables
process.env.THEEYE_JOB = JSON.stringify({ id: '', task_id: '' })
process.env.THEEYE_JOB_USER = JSON.stringify({ id: '', email: '', username: '' })
process.env.THEEYE_JOB_WORKFLOW = JSON.stringify({ job_id: '', id: '' })
process.env.THEEYE_ORGANIZATION_NAME = JSON.stringify('')
process.env.THEEYE_API_URL = JSON.stringify('https://supervisor.theeye.io')

const dotenv = (process.env.DOTENV_PATH)
require('dotenv').config({ path: dotenv })

console.log('theeye-bot-sdk')
console.log(`node version: ${process.version}`)

// error and output handlers must go first.

/**
 * @param {Object}
 * @prop {Mixed} data
 * @prop {Array} components
 * @prop {Object} next
 */
const successOutput = (options = {}) => {
  // https://documentation.theeye.io/core-concepts/scripts/#passing-arguments-in-workflow
  const output = Object.assign({ state: 'success' }, options)
  console.log( JSON.stringify(output) )
  process.exit(0)
}

/**
 * @param {Error} err
 */
const failureOutput = (err) => {
  console.error(err)
  const output = {
    state: "failure",
    data: {
      message: err.message,
      code: err.code,
      data: err.data
    }
  }
  console.error( JSON.stringify(output) )
  process.exit(1)
}

process.on('unhandledRejection', (reason, p) => {
  console.error(reason, 'Unhandled Rejection at Promise', p)
  failureOutput(reason)
})

process.on('uncaughtException', err => {
  console.error(err, 'Uncaught Exception thrown')
  failureOutput(err)
})

process.once('SIGINT', function (code) {
  console.log('SIGINT received');
  const err = new Error('SIGINT received')
  err.code = code
  failureOutput(err)
})

process.once('SIGTERM', function (code) {
  console.log('SIGTERM received...');
  const err = new Error('SIGTERM received')
  err.code = code
  failureOutput(err)
})

const createHandler = exports.createHandler = (main, caller = undefined) => {
  console.log(`Boilerplate handler created for ${process.argv[1]}`)
  // create a function ready to be executed
  const handler = async (args = undefined) => {
    try {
      // arguments are optional.
      // if arguments are not provided process.argv will be used as arguments
      args || (args = process.argv.slice(2))
      const result = await main(args)
      successOutput(result)
    } catch (err) {
      failureOutput(err)
    }
  }

  // if the handled function script was executed directly, run the handler
  if (caller && require.main === caller) {
    return handler()
  } else {
    return handler
  }
}

const executeHandler = exports.executeHandler = async (main, args) => {
  return createHandler(main)(args)
}
