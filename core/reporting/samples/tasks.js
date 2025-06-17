const tasks = require('./tasks.json')

console.log('"id";"name";"type";"execution_count";"creation_date";"org_id";"acl"')
tasks.forEach(m => {

  let line = ''
  line += `"${m._id.$oid}";`
  line += `"${m.name}";`
  line += `"${m.type}";`
  line += `"${m.execution_count}";`
  line += `"${m.customer.$oid}";`
  line += `"${m.creation_date.$date}"`
  if (m.acl) {
    m.acl.forEach(a => {
      let acl = `${line}"${a}"`
      console.log(acl)
    })
  } else {
    console.log(line)
  }

})

