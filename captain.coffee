TASK_RE = /^\[(.+?)] Running (.*)/
SUBTASK_RE = /^\[(.+?)\] \[(.+?)\] (\w+):\s*(.*)$/


elapsed = (start, stop) ->
    str_to_date = (str) ->
        d = (parseInt(i) for i in /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(str)[1..])
        new Date(d[0], d[1], d[2], d[3], d[4], d[5])

    (str_to_date(stop) - str_to_date(start)) / 1000

exports.parselog = (stream) ->
    state = 
        task: ""
        queue: {}
        failed: []
        completed: []

    for line in stream.split("\n")
        if TASK_RE.test(line)
            [date, task] = TASK_RE.exec(line)[1..]
            if state.task != ""
                [prev_time, prev_task] = state.task
                state.completed.push([prev_task, elapsed(prev_time, date)])
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
