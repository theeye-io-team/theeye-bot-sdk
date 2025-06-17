const { createHandler } = require('../core/boilerplate')

async function main (args) {
  console.log('Starting main function execution...')
  console.log('Received arguments:', args)

  // Simulate some work
  console.log('Performing some work...')
  const result = {
    message: "Hello from simple script!",
    args: args,
    timestamp: new Date().toISOString()
  }

  console.log('Work completed, returning result...')
  // Return the result which will be included in the success output
  return { data: result }
}

// Create and execute the handler with this file as the caller
console.log('Creating and executing handler...')
createHandler(main, { caller: module }) 