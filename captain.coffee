TASK_RE = /^\[(.+?)] (Finished|Running) (.*)/
SUBTASK_RE = /^\[(.+?)\] \[(.+?)\] (\w+):\s*(.*)$/


exports.parselog = (stream) ->
    state =
        task: ""
        queue: {}
        failed: []
        completed: []

    for line in stream.split("\n")
        if TASK_RE.test(line)
            [date, status, task] = TASK_RE.exec(line)[1..]
            if status == "Running"
                state.task = [date, task]
            else if status == "Finished"
                [task, time] = /^(.+?) \(([\d\.]+)s\)/.exec(task)[1..]
                state.completed.push([task, time])
            state.task = [date, task]
        else if SUBTASK_RE.test(line)
            [date, host, kind, text] = SUBTASK_RE.exec(line)[1..]
            if kind == "running"
                state.queue[host] = text
            else if kind == "finished"
                [msg, time] = /^(.*)\s+\((.*)\)$/.exec(text)[1..]
                if state.queue[host] == msg
                    delete state.queue[host]
            else if kind == "failed"
                [date, task] = state.task
                state["failed"].push([date, task, host, text])

    state
