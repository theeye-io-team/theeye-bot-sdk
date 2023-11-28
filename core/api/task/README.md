

## Environment

THEEYE_API_URL

THEEYE_ORGANIZATION_NAME

TASK_ID

TASK_SECRET

```
const Task = require('theeye-bot-sdk/core/api/task')

const task = new Task()
task.run({ id: '', secret: '', body: [ 'arg1', 'arg2' ] })
```
