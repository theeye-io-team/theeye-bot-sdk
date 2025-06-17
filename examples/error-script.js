const { createHandler } = require('../core/boilerplate')

async function main (args) {
  console.log('Starting main function execution...')
  console.log('Received arguments:', args)

  // Simulate some validation
  if (!args || args.length === 0) {
    const error = new Error('No arguments provided')
    error.code = 'MISSING_ARGS'
    error.data = { required: true }
    throw error
  }

  // Simulate some work that might fail
  console.log('Performing some work...')
  if (args[0] === 'error') {
    const error = new Error('Simulated error during work')
    error.code = 'WORK_ERROR'
    error.data = { 
      step: 'processing',
      args: args
    }
    throw error
  }

  const result = {
    message: "Work completed successfully!",
    args: args,
    timestamp: new Date().toISOString()
  }

  console.log('Work completed, returning result...')
  return { data: result }
}

// Create and execute the handler with this file as the caller
console.log('Creating and executing handler...')
createHandler(main, { caller: module }) 