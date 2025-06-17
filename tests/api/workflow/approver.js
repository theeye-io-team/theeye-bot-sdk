
const Workflow = require('../../../core/api/workflow')

const Token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjBkZjRlODcxZDZjZjM2Yjg5MTc2NjQ5IiwiaWF0IjoxNjI1MjQ3MzY3LCJleHAiOjE2MjUyNTgxNjd9.U3bA3pyWO-xTW1r-IZc3_vRYzav2cPFSXNKV2yE3yFk"

const main = async (workflowId, workflowJobId) => {

  const workflow = new Workflow({ access_token: Token })
  workflow.workflowJob = {
    id: workflowId,
    job_id: workflowJobId
  }

  const approver = await workflow.getApprover({ taskName: 'Solicitar Aprobación' })
  return { data: approver }

}


/**
 * @param {Array} data
 */
const outputSuccess = ({ data, components }) => {
  let output = { state: "success", data, components }
  console.log( JSON.stringify(output) )
}

/**
 * @param {Error} err
 */
const outputFailure = (err) => {
  console.error(err)
  let output = { state: "failure", data: [ err.message, err.data, { count: err.count } ] }
  console.error( JSON.stringify(output) )
  process.exit(1)
}

main(process.argv[2], process.argv[3]).then(outputSuccess).catch(outputFailure)
