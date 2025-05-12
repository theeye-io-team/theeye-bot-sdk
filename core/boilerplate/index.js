const path = require('path')
require('dotenv').config({ path: process.env.DOTENV_PATH })

process.env.THEEYE_JOB = process.env.THEEYE_JOB || JSON.stringify({ id: '', task_id: '' })
process.env.THEEYE_JOB_USER = process.env.THEEYE_JOB_USER || JSON.stringify({ id: '', email: '', username: '' })
process.env.THEEYE_JOB_WORKFLOW = process.env.THEEYE_JOB_WORKFLOW || JSON.stringify({ job_id: '', id: '' })
process.env.THEEYE_ORGANIZATION_NAME = process.env.THEEYE_ORGANIZATION_NAME || JSON.stringify('')
process.env.THEEYE_API_URL = process.env.THEEYE_API_URL || JSON.stringify('https://supervisor.theeye.io')

console.log('theeye-bot-sdk')
console.log(`node version: ${process.version}`)

// ---------------- graceful shutdown handler ----------------

function gracefullyShutdown({ onCleanup } = {}) {
  let isShuttingDown = false

  const shutdown = async (reason, err = null) => {
    if (isShuttingDown) return
    isShuttingDown = true

    try {
      if (onCleanup && typeof onCleanup === 'function') {
        await onCleanup()
      }
    } catch (cleanupErr) {
      failureOutput(cleanupErr)
      return
    }

    if (err) {
      failureOutput(err)
    } else {
      const shutdownError = new Error(`Process terminated: ${reason}`)
      shutdownError.code = 'SHUTDOWN'
      failureOutput(shutdownError)
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT', new Error('SIGINT received')))
  process.on('SIGTERM', () => shutdown('SIGTERM', new Error('SIGTERM received')))
  process.on('uncaughtException', err => shutdown('uncaughtException', err))
  process.on('unhandledRejection', reason => {
    const err = reason instanceof Error ? reason : new Error(String(reason))
    shutdown('unhandledRejection', err)
  })

  return shutdown
}

// ---------------- output handlers ----------------

const shutdown = gracefullyShutdown()

const successOutput = (options = {}) => {
  const output = Object.assign({ state: 'success' }, options)
  console.log(JSON.stringify(output))
  process.exit(0)
}

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
  console.error(JSON.stringify(output))
  process.exit(1)
}

// ---------------- boilerplate execution logic ----------------

const createHandler = exports.createHandler = (main, caller, options = {}) => {
  console.log(`Boilerplate handler created for ${process.argv[1]}`)
  
  const handler = async (args = undefined) => {
    try {
      args ||= process.argv.slice(2)
      const result = await main(args)
      
      // Run cleanup before success output
      if (options.onCleanup) {
        try {
          await options.onCleanup()
        } catch (cleanupErr) {
          failureOutput(cleanupErr)
          return
        }
      }
      
      successOutput(result)
    } catch (err) {
      // Run cleanup before failure output
      if (options.onCleanup) {
        try {
          await options.onCleanup()
        } catch (cleanupErr) {
          failureOutput(cleanupErr)
          return
        }
      }
      
      failureOutput(err)
    }
  }

  // Set up shutdown handlers
  const shutdown = gracefullyShutdown({
    onCleanup: options.onCleanup
  })

  if (caller && require.main === caller) {
    return handler()
  } else {
    return handler
  }
}

exports.executeHandler = async (main, args) => {
  return createHandler(main)(args)
}
